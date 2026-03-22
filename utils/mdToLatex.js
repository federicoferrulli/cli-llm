// Caratteri speciali LaTeX da escapare nel testo normale
function escapeLatexBasic(text) {
    return text
        .replace(/\\/g, "\u0000BACKSLASH\u0000")
        .replace(/&/g,  "\\&")
        .replace(/%/g,  "\\%")
        .replace(/\$/g, "\\$")
        .replace(/#/g,  "\\#")
        .replace(/\{/g, "\\{")
        .replace(/\}/g, "\\}")
        .replace(/~/g,  "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}")
        .replace(/\u0000BACKSLASH\u0000/g, "\\textbackslash{}")
        // underscore: solo fuori da parole composte (es: snake_case)
        .replace(/_/g, "\\_");
}

// Formattazione inline: esegue prima il markup, poi escapa il testo residuo
function processInline(text) {
    const tokens = [];

    const protect = (latex) => {
        const idx = tokens.length;
        tokens.push(latex);
        return `\u0001${idx}\u0001`;
    };

    // Bold **text** o __text__
    text = text.replace(/\*\*(.+?)\*\*/g, (_, c) => protect(`\\textbf{${escapeLatexBasic(c)}}`));
    text = text.replace(/__(.+?)__/g,     (_, c) => protect(`\\textbf{${escapeLatexBasic(c)}}`));

    // Italic *text* o _text_
    text = text.replace(/\*(.+?)\*/g,     (_, c) => protect(`\\textit{${escapeLatexBasic(c)}}`));
    text = text.replace(/_(.+?)_/g,       (_, c) => protect(`\\textit{${escapeLatexBasic(c)}}`));

    // Inline code `text`
    text = text.replace(/`(.+?)`/g,       (_, c) => protect(`\\texttt{${c}}`));

    // Link [label](url)
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, (_, label, url) =>
        protect(`\\href{${url}}{${escapeLatexBasic(label)}}`)
    );

    // Escapa il testo residuo (non protetto)
    text = escapeLatexBasic(text);

    // Ripristina i token protetti
    text = text.replace(/\u0001(\d+)\u0001/g, (_, i) => tokens[parseInt(i)]);

    return text;
}

// Converte un singolo file MD in blocchi LaTeX (senza preamble/documento)
function convertMdBody(mdContent) {
    // Rimuove eventuali wrapper markdown globali (spesso aggiunti dagli LLM)
    mdContent = mdContent.trim();
    if (mdContent.toLowerCase().startsWith("```markdown")) {
        const firstNewline = mdContent.indexOf("\n");
        if (firstNewline !== -1) {
            mdContent = mdContent.slice(firstNewline + 1).trim();
        }
    }
    if (mdContent.endsWith("```")) {
        const lastNewline = mdContent.lastIndexOf("\n");
        if (lastNewline !== -1) {
            const trail = mdContent.slice(lastNewline + 1).trim();
            if (trail === "```") {
                mdContent = mdContent.slice(0, lastNewline).trim();
            }
        }
    }
    
    const lines = mdContent.split("\n");
    let out = "";

    let inCodeBlock    = false;
    let codeLines      = [];
    let inItemize      = false;
    let inEnumerate    = false;
    let inBlockquote   = false;
    let paragraphBuf   = [];

    const flushParagraph = () => {
        if (paragraphBuf.length === 0) return;
        out += paragraphBuf.join(" ").trim() + "\n\n";
        paragraphBuf = [];
    };

    const closeList = () => {
        if (inItemize)    { out += "\\end{itemize}\n\n";    inItemize    = false; }
        if (inEnumerate)  { out += "\\end{enumerate}\n\n";  inEnumerate  = false; }
    };

    const closeBlockquote = () => {
        if (inBlockquote) { out += "\\end{quote}\n\n"; inBlockquote = false; }
    };

    for (const line of lines) {

        // --- Blocchi di codice ---
        if (line.trim().startsWith("```")) {
            if (!inCodeBlock) {
                flushParagraph();
                closeList();
                closeBlockquote();
                inCodeBlock = true;
                codeLines = [];
            } else {
                inCodeBlock = false;
                out += `\\begin{verbatim}\n${codeLines.join("\n")}\n\\end{verbatim}\n\n`;
                codeLines = [];
            }
            continue;
        }
        if (inCodeBlock) { codeLines.push(line); continue; }

        // --- Linee vuote ---
        if (line.trim() === "") {
            flushParagraph();
            closeList();
            closeBlockquote();
            out += "\n";
            continue;
        }

        // --- Headings ---
        const h1 = line.match(/^#\s+(.*)/);
        const h2 = line.match(/^##\s+(.*)/);
        const h3 = line.match(/^###\s+(.*)/);
        const h4 = line.match(/^####\s+(.*)/);
        if (h1 || h2 || h3 || h4) {
            flushParagraph();
            closeList();
            closeBlockquote();
            if (h4) out += `\\subsubsection{${processInline(h4[1])}}\n\n`;
            else if (h3) out += `\\subsection{${processInline(h3[1])}}\n\n`;
            else if (h2) out += `\\section{${processInline(h2[1])}}\n\n`;
            else if (h1) out += `\\chapter{${processInline(h1[1])}}\n\n`;
            continue;
        }

        // --- Separatore orizzontale ---
        if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
            flushParagraph();
            closeList();
            out += "\\bigskip\\hrule\\bigskip\n\n";
            continue;
        }

        // --- Lista non ordinata ---
        const ulMatch = line.match(/^\s*[-*]\s+(.*)/);
        if (ulMatch) {
            flushParagraph();
            closeBlockquote();
            if (!inItemize) { out += "\\begin{itemize}\n"; inItemize = true; }
            out += `  \\item ${processInline(ulMatch[1])}\n`;
            continue;
        }

        // --- Lista ordinata ---
        const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
        if (olMatch) {
            flushParagraph();
            closeBlockquote();
            if (!inEnumerate) { out += "\\begin{enumerate}\n"; inEnumerate = true; }
            out += `  \\item ${processInline(olMatch[1])}\n`;
            continue;
        }

        // --- Blockquote ---
        if (line.startsWith("> ")) {
            flushParagraph();
            closeList();
            if (!inBlockquote) { out += "\\begin{quote}\n"; inBlockquote = true; }
            out += processInline(line.slice(2)) + "\n";
            continue;
        }

        // --- Testo normale (accumula in paragrafo) ---
        closeList();
        closeBlockquote();
        paragraphBuf.push(processInline(line));
    }

    flushParagraph();
    closeList();
    closeBlockquote();

    return out;
}

// Genera un documento LaTeX completo da un array di file MD
export function buildLatexDocument(mdFiles, title, author = "Generato con cli-llm") {
    const today = new Date().toISOString().split("T")[0];

    const preamble = `\\documentclass[12pt,a4paper]{book}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[italian]{babel}
\\usepackage{lmodern}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{verbatim}
\\usepackage{parskip}
\\geometry{margin=2.5cm, top=3cm, bottom=3cm}
\\hypersetup{colorlinks=true, linkcolor=black, urlcolor=blue}

\\title{${escapeLatexBasic(title)}}
\\author{${escapeLatexBasic(author)}}
\\date{${today}}

\\begin{document}
\\maketitle
\\tableofcontents
\\newpage

`;

    const body = mdFiles
        .map(({ content }) => convertMdBody(content))
        .join("\n\\clearpage\n");

    return preamble + body + "\n\\end{document}\n";
}

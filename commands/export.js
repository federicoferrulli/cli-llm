import fs from "fs";
import path from "path";
import { marked } from "marked";
import puppeteer from "puppeteer-core";
import { buildLatexDocument } from "../utils/mdToLatex.js";

// --- Ricerca Chrome/Edge installato su Windows ---
function findBrowser() {
    const candidates = [
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter(Boolean);

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// --- Template HTML per il PDF ---
function buildHtml(title, htmlBody, author) {
    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 2.5cm; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.7;
      color: #1a1a1a;
    }
    h1 { font-size: 22pt; margin-top: 2em; page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    h2 { font-size: 16pt; margin-top: 1.5em; }
    h3 { font-size: 13pt; margin-top: 1em; }
    h4 { font-size: 12pt; margin-top: 0.8em; }
    code {
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      background: #f4f4f4;
      padding: 0.15em 0.4em;
      border-radius: 3px;
    }
    pre {
      background: #f4f4f4;
      padding: 1em;
      border-radius: 5px;
      font-size: 10pt;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 3px solid #aaa;
      padding-left: 1em;
      margin-left: 0;
      color: #555;
      font-style: italic;
    }
    ul, ol { padding-left: 1.5em; }
    li { margin-bottom: 0.3em; }
    .title-page {
      text-align: center;
      padding-top: 30%;
    }
    .title-page h1 {
      font-size: 28pt;
      page-break-before: avoid;
      border-bottom: 2px solid #333;
      padding-bottom: 0.5em;
    }
    .title-page .author { font-size: 13pt; margin-top: 1em; color: #555; }
    .title-page .date   { font-size: 11pt; color: #888; }
    hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
  </style>
</head>
<body>
  <div class="title-page">
    <h1>${title}</h1>
    <div class="author">${author}</div>
    <div class="date">${new Date().toISOString().split("T")[0]}</div>
  </div>
  ${htmlBody}
</body>
</html>`;
}

// --- Estrae il contenuto markdown da un file, gestendo wrapper JSON e Markdown ---
function extractMdContent(raw) {
    let content = raw.trim();

    // Caso 1: blocco ```json\n...\n``` (risposta LLM che wrappa JSON in markdown)
    if (content.toLowerCase().startsWith("```json")) {
        const firstNewline = content.indexOf("\n");
        if (firstNewline !== -1) {
            // Trova il ``` di chiusura (cerca dall'inizio del contenuto dopo l'apertura)
            const inner = content.slice(firstNewline + 1);
            const closingBacktick = inner.lastIndexOf("\n```");
            const jsonStr = closingBacktick !== -1 ? inner.slice(0, closingBacktick) : inner;
            try {
                const obj = JSON.parse(jsonStr);
                if (obj && typeof obj.content === "string") return obj.content.trim();
            } catch (_) { /* non è JSON valido, continua */ }
        }
    }

    // Caso 2: il file è JSON puro (senza backtick)
    if (content.startsWith("{")) {
        try {
            const obj = JSON.parse(content);
            if (obj && typeof obj.content === "string") return obj.content.trim();
        } catch (_) { /* non è JSON valido, continua */ }
    }

    // Caso 3: blocco ```markdown ... ``` 
    if (content.toLowerCase().startsWith("```markdown")) {
        const firstNewline = content.indexOf("\n");
        if (firstNewline !== -1) content = content.slice(firstNewline + 1).trim();
    }

    // Rimuove trailing ``` se presente
    if (content.endsWith("```")) {
        const lastNewline = content.lastIndexOf("\n");
        if (lastNewline !== -1) {
            const trail = content.slice(lastNewline + 1).trim();
            if (trail === "```") content = content.slice(0, lastNewline).trim();
        }
    }

    return content.trim();
}

// --- Legge e ordina i file MD di un libro ---
function getMdFiles(bookDir) {
    return fs.readdirSync(bookDir)
        .filter(f => f.endsWith(".md") && !f.startsWith("_"))
        .sort()
        .map(f => {
            const raw = fs.readFileSync(path.join(bookDir, f), "utf8");
            const content = extractMdContent(raw);
            return {
                name: f,
                path: path.join(bookDir, f),
                content,
            };
        });
}

// --- Estrae titolo dal primo H1 trovato, fallback al nome directory ---
function extractTitle(mdFiles, dirName) {
    for (const { content } of mdFiles) {
        const m = content.match(/^#\s+(.+)$/m);
        if (m) return m[1].trim();
    }
    return dirName.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

// --- Esegue materialmente l'export (LaTeX e PDF) ---
async function runExport(mdFiles, title, author, outputBase, targetDir, browser) {
    // --- LaTeX ---
    const texOutput = path.join(targetDir, `${outputBase}.tex`);
    try {
        const latex = buildLatexDocument(mdFiles, title, author);
        fs.writeFileSync(texOutput, latex, "utf8");
        console.log(`  LaTeX  -> ${texOutput}`);
    } catch (err) {
        console.error(`  LaTeX  ERRORE: ${err.message}`);
    }

    // --- PDF via puppeteer-core ---
    const pdfOutput = path.join(targetDir, `${outputBase}.pdf`);
    try {
        const combinedMd = mdFiles.map(f => f.content).join("\n\n---\n\n");
        const htmlBody = marked(combinedMd);
        const fullHtml = buildHtml(title, htmlBody, author);

        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: "networkidle0" });
        await page.pdf({
            path: pdfOutput,
            format: "A4",
            printBackground: true,
            margin: { top: "2.5cm", bottom: "2.5cm", left: "2.5cm", right: "2.5cm" },
        });
        await page.close();

        console.log(`  PDF    -> ${pdfOutput}`);
    } catch (err) {
        console.error(`  PDF    ERRORE: ${err.message}`);
    }
}

// --- Export di un intero libro (directory) ---
async function exportBook(bookDir, bookSlug, browser) {
    const mdFiles = getMdFiles(bookDir);

    if (mdFiles.length === 0) {
        console.log("  Nessun file .md trovato, skip.");
        return;
    }

    const title = extractTitle(mdFiles, bookSlug);
    const author = "Generato con cli-llm";
    console.log(`  Titolo:   ${title}`);
    console.log(`  Capitoli: ${mdFiles.length} file`);

    await runExport(mdFiles, title, author, bookSlug, bookDir, browser);
}

// --- Comando principale ---
export async function exportCommand(args) {
    const booksRoot = path.join(process.cwd(), "books");
    const targetSlug = args[0];

    // Trova browser
    const executablePath = findBrowser();
    if (!executablePath) {
        console.error("\nErrore: Chrome o Edge non trovato.");
        console.error("Installa Google Chrome o Microsoft Edge per generare i PDF.\n");
        process.exit(1);
    }

    // Caso 1: Export di un singolo file specifico
    if (targetSlug) {
        let filePath = path.resolve(targetSlug);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(booksRoot, targetSlug);
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (!filePath.toLowerCase().endsWith(".md")) {
                console.error(`\nErrore: Il file deve essere un .md -> ${filePath}\n`);
                process.exit(1);
            }

            console.log(`\nExport di un singolo file: ${path.basename(filePath)}...\n`);
            
            const browser = await puppeteer.launch({
                executablePath,
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });

            try {
                const raw = fs.readFileSync(filePath, "utf8");
                const content = extractMdContent(raw);
                const mdFile = {
                    name: path.basename(filePath),
                    path: filePath,
                    content,
                };
                const title = extractTitle([mdFile], path.basename(filePath, ".md"));
                const author = "Generato con cli-llm";
                const outputBase = path.basename(filePath, ".md");
                const targetDir = path.dirname(filePath);

                await runExport([mdFile], title, author, outputBase, targetDir, browser);
            } finally {
                await browser.close();
            }
            
            console.log("\nExport completato.\n");
            return;
        }
    }

    // Caso 2: Export di directory (comportamento originale)
    if (!fs.existsSync(booksRoot)) {
        console.error(`\nNessuna cartella "books/" trovata in: ${process.cwd()}`);
        console.error(`Genera prima un libro con: llm books "<argomento>"\n`);
        process.exit(1);
    }

    const allSlugs = fs.readdirSync(booksRoot).filter(name =>
        fs.statSync(path.join(booksRoot, name)).isDirectory()
    );

    if (allSlugs.length === 0) {
        console.log(`\nNessun libro trovato in ${booksRoot}\n`);
        process.exit(0);
    }

    const toExport = targetSlug
        ? allSlugs.filter(s => s === targetSlug)
        : allSlugs;

    if (targetSlug && toExport.length === 0) {
        console.error(`\nLibro non trovato: "${targetSlug}"`);
        console.error(`Libri disponibili: ${allSlugs.join(", ")}\n`);
        process.exit(1);
    }

    console.log(`\nExport di ${toExport.length} libro/i (browser: ${path.basename(executablePath)})...\n`);

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        for (const slug of toExport) {
            console.log(`[${slug}]`);
            await exportBook(path.join(booksRoot, slug), slug, browser);
        }
    } finally {
        await browser.close();
    }

    console.log("\nExport completato.\n");
}

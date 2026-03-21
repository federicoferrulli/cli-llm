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

// --- Legge e ordina i file MD di un libro ---
function getMdFiles(bookDir) {
    return fs.readdirSync(bookDir)
        .filter(f => f.endsWith(".md") && !f.startsWith("_"))
        .sort()
        .map(f => ({
            name: f,
            path: path.join(bookDir, f),
            content: fs.readFileSync(path.join(bookDir, f), "utf8"),
        }));
}

// --- Estrae titolo dal primo H1 trovato, fallback al nome directory ---
function extractTitle(mdFiles, dirName) {
    for (const { content } of mdFiles) {
        const m = content.match(/^#\s+(.+)$/m);
        if (m) return m[1].trim();
    }
    return dirName.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

// --- Export di un singolo libro ---
async function exportBook(bookDir, bookSlug, browser) {
    const mdFiles = getMdFiles(bookDir);

    if (mdFiles.length === 0) {
        console.log("  Nessun file .md trovato, skip.");
        return;
    }

    const title  = extractTitle(mdFiles, bookSlug);
    const author = "Generato con cli-llm";
    console.log(`  Titolo:   ${title}`);
    console.log(`  Capitoli: ${mdFiles.length} file`);

    // --- LaTeX ---
    const texOutput = path.join(bookDir, `${bookSlug}.tex`);
    try {
        const latex = buildLatexDocument(mdFiles, title, author);
        fs.writeFileSync(texOutput, latex, "utf8");
        console.log(`  LaTeX  -> ${texOutput}`);
    } catch (err) {
        console.error(`  LaTeX  ERRORE: ${err.message}`);
    }

    // --- PDF via puppeteer-core ---
    const pdfOutput = path.join(bookDir, `${bookSlug}.pdf`);
    try {
        const combinedMd  = mdFiles.map(f => f.content).join("\n\n---\n\n");
        const htmlBody     = marked(combinedMd);
        const fullHtml     = buildHtml(title, htmlBody, author);

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

// --- Comando principale ---
export async function exportCommand(args) {
    const booksRoot  = path.join(process.cwd(), "books");
    const targetSlug = args[0];

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

    if (toExport.length === 0) {
        console.error(`\nLibro non trovato: "${targetSlug}"`);
        console.error(`Libri disponibili: ${allSlugs.join(", ")}\n`);
        process.exit(1);
    }

    // Trova browser
    const executablePath = findBrowser();
    if (!executablePath) {
        console.error("\nErrore: Chrome o Edge non trovato.");
        console.error("Installa Google Chrome o Microsoft Edge per generare i PDF.\n");
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

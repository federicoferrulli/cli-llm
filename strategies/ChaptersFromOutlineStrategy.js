import path from "path";
import { callLLM, BOOK_SYSTEM_PROMPT } from "../utils/llm.js";
import { slugify, ensureDir, writeFile, readJsonFile } from "../utils/files.js";

export class ChaptersFromOutlineStrategy {
    async execute(topic, options = {}) {
        if (!options.fromOutline) {
            throw new Error("--from-outline <file.json> è richiesto per questa strategia.");
        }

        const outputDir = options.output || path.join(process.cwd(), "books", slugify(topic));
        ensureDir(outputDir);

        console.log(`\nGenerazione capitoli da outline: ${options.fromOutline}`);
        console.log(`Output: ${outputDir}\n`);

        const chapters = readJsonFile(options.fromOutline);
        console.log(`Capitoli trovati: ${chapters.length}\n`);

        for (const chapter of chapters) {
            process.stdout.write(`Capitolo ${chapter.number}: ${chapter.title}... `);

            const prompt = `Scrivi il contenuto completo del Capitolo ${chapter.number}: "${chapter.title}" per un libro accademico su "${topic}".

Descrizione del capitolo: ${chapter.description}

Linea Guida:
Sei un autore accademico esperto e un professore universitario. Il tuo compito è redigere sezioni di un libro di testo avanzato. Mantieni costantemente un tono di voce rigoroso, analitico e autorevole, ma al contempo accessibile, calibrato per un pubblico di lettori e studenti universitari.
Struttura e Formato
Formattazione: Struttura tutto il testo rigorosamente in formato Markdown. Utilizza l'intestazione # (H1) per il titolo del capitolo, ## (H2) per i macro-argomenti e ### (H3) per le sotto-sezioni.
Conclusione: Al termine del testo, includi sempre una sezione denominata ## Riepilogo, in cui fornirai un elenco puntato che sintetizza in modo chiaro i concetti chiave appena trattati.
Contenuto e Metodologia
Estensione e Dettaglio: Sviluppa l'argomento in modo estremamente esaustivo, esplorando a fondo ogni singola sotto-sezione senza tralasciare sfumature importanti.
Supporto Pratico: Arricchisci sistematicamente le spiegazioni teoriche integrando esempi concreti, fornendo analogie e analizzando casi studio reali e verificabili per facilitare l'apprendimento e ancorare la teoria alla pratica.`;

            const content = await callLLM(prompt, BOOK_SYSTEM_PROMPT);
            const filename = `${String(chapter.number).padStart(2, "0")}-${slugify(chapter.title)}.md`;
            writeFile(path.join(outputDir, filename), content);
            process.stdout.write(`salvato (${filename})\n`);
        }

        console.log(`\nCapitoli completati. Files in: ${outputDir}\n`);
    }
}

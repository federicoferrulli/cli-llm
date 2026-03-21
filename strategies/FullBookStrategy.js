import path from "path";
import { callLLM, BOOK_SYSTEM_PROMPT } from "../utils/llm.js";
import { slugify, ensureDir, writeFile } from "../utils/files.js";

export class FullBookStrategy {
    async execute(topic, options = {}) {
        const outputDir = options.output || path.join(process.cwd(), "books", slugify(topic));
        ensureDir(outputDir);

        console.log(`\nGenerazione libro su: "${topic}"`);
        console.log(`Output: ${outputDir}\n`);

        // Step 1: genera struttura capitoli
        console.log("[1/2] Generazione struttura capitoli...");
        const chapters = await this._generateOutline(topic);

        writeFile(path.join(outputDir, "outline.json"), JSON.stringify(chapters, null, 2));
        console.log(`      Struttura generata: ${chapters.length} capitoli`);
        chapters.forEach(ch => console.log(`      ${String(ch.number).padStart(2, " ")}. ${ch.title}`));

        // Step 2: genera contenuto per ogni capitolo
        console.log("\n[2/2] Generazione contenuto capitoli...");
        for (const chapter of chapters) {
            process.stdout.write(`      Capitolo ${chapter.number}: ${chapter.title}... `);
            const content = await this._generateChapter(topic, chapter);
            const filename = `${String(chapter.number).padStart(2, "0")}-${slugify(chapter.title)}.md`;
            writeFile(path.join(outputDir, filename), content);
            process.stdout.write(`salvato (${filename})\n`);
        }

        console.log(`\nLibro completato. Files in: ${outputDir}\n`);
    }

    async _generateOutline(topic) {
        const prompt = `Genera la struttura dei capitoli per un libro completo e accademico sull'argomento: "${topic}".

Rispondi ESCLUSIVAMENTE con un array JSON valido (nessun testo prima o dopo), nel seguente formato:
[
  {"number": 1, "title": "Titolo Capitolo", "description": "Descrizione del contenuto del capitolo"},
  ...
]

Genera tra 15 e 20 capitoli ben strutturati, progressivi e coerenti con l'argomento e tra di loro.`;

        const raw = await callLLM(prompt, BOOK_SYSTEM_PROMPT);

        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error("Il modello non ha restituito un JSON valido per la struttura dei capitoli.");
        }
        return JSON.parse(jsonMatch[0]);
    }

    async _generateChapter(topic, chapter) {
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

        return await callLLM(prompt, BOOK_SYSTEM_PROMPT);
    }
}

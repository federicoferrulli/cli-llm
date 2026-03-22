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
            const content = await this._generateChapter(topic, chapter, chapters);
            const filename = `${String(chapter.number).padStart(2, "0")}-${slugify(chapter.title)}.md`;
            writeFile(path.join(outputDir, filename), content);
            process.stdout.write(`salvato (${filename})\n`);
        }

        console.log(`\nLibro completato. Files in: ${outputDir}\n`);
    }

    async _generateOutline(topic) {
        const prompt = `<persona>
Sei un autore accademico di fama mondiale e un architetto dell'informazione esperto nella progettazione didattica avanzata.
</persona>

<task>
Il tuo compito è generare la struttura dei capitoli per un libro completo, accademico e autorevole sull'argomento: "${topic}".
La struttura deve seguire una progressione logica rigorosa: dalle fondamenta teoriche alle applicazioni avanzate, analisi critica e conclusioni.
</task>

<requirements>
- Numero di capitoli: tra 15 e 20.
- Lingua: Italiano.
- Ogni capitolo deve avere un titolo e una descrizione dettagliata di ciò che verrà trattato.
- Assicurati che non ci siano sovrapposizioni inutili tra i capitoli.
</requirements>

<output_format>
Rispondi ESCLUSIVAMENTE con un array JSON valido (nessun markdown, nessun testo prima o dopo), nel seguente formato:
[
  {
    "number": 1,
    "title": "Titolo del Capitolo",
    "description": "Descrizione esaustiva dei contenuti, obiettivi didattici e punti chiave che verranno trattati in questo capitolo."
  },
  ...
]
</output_format>`;

        const raw = await callLLM(prompt, BOOK_SYSTEM_PROMPT);

        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error("Il modello non ha restituito un JSON valido per la struttura dei capitoli.");
        }
        return JSON.parse(jsonMatch[0]);
    }

    async _generateChapter(topic, chapter, outline) {
        const prompt = `<persona>
Sei un eminente professore universitario e autore di testi accademici. Il tuo stile è rigoroso, analitico, denso di contenuti ma fluido nella lettura.
</persona>

<context>
Argomento del libro: "${topic}"
Capitolo attuale: Capitolo ${chapter.number} - "${chapter.title}"
Descrizione del capitolo: ${chapter.description}

<full_outline>
Ecco la struttura completa del libro per garantirti la massima coerenza e evitare ripetizioni con altri capitoli:
${JSON.stringify(outline, null, 2)}
</full_outline>
</context>

<instructions>
1. **Contenuto**: Scrivi il contenuto completo e dettagliato di questo capitolo. Esplora a fondo ogni concetto menzionato nella descrizione. 
2. **Lunghezza**: Deve contenere almeno 8000 parole.
3. **Stile**: Mantieni un tono autorevole. Usa terminologia tecnica appropriata senza essere oscuro.
4. **Esempi**: Integra esempi pratici, casi studio o analogie per approfondire la teoria.
5. **Formattazione**: Usa Markdown.
    - # Per il titolo del capitolo.
    - ## Per i paragrafi principali.
    - ### Per i sotto-paragrafi.
    - Enfatizza i termini chiave in **grassetto**.
6. **Riepilogo**: Concludi sempre con una sezione "## Riepilogo" con un elenco puntato dei punti chiave.
7. **Coerenza**: Non introdurre il libro intero. Concentrati esclusivamente su questo capitolo, sapendo che gli altri argomenti sono trattati altrove come indicato nell'outline.
</instructions>`;

        return await callLLM(prompt, BOOK_SYSTEM_PROMPT);
    }
}

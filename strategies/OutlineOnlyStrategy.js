import path from "path";
import { callLLM, BOOK_SYSTEM_PROMPT } from "../utils/llm.js";
import { slugify, ensureDir, writeFile } from "../utils/files.js";

export class OutlineOnlyStrategy {
    async execute(topic, options = {}) {
        const outputDir = options.output || path.join(process.cwd(), "books", slugify(topic));
        ensureDir(outputDir);

        console.log(`\nGenerazione struttura per: "${topic}"`);

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
            throw new Error("Il modello non ha restituito un JSON valido.");
        }

        const chapters = JSON.parse(jsonMatch[0]);
        const outlineFile = path.join(outputDir, "outline.json");
        writeFile(outlineFile, JSON.stringify(chapters, null, 2));

        console.log(`Struttura salvata in: ${outlineFile}\n`);
        chapters.forEach(ch => console.log(`  ${String(ch.number).padStart(2, " ")}. ${ch.title}`));
        console.log(`\nPer generare i capitoli:\n  llm books "${topic}" --from-outline ${outlineFile}\n`);
    }
}

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
        let chapters = null;
        try {
            chapters = await this._generateOutline(topic);
        } catch (e) {
            console.error(e);
            process.exit(1);
        }

        writeFile(path.join(outputDir, "outline.json"), JSON.stringify(chapters, null, 2));
        console.log(`      Struttura generata: ${chapters.length} capitoli`);
        chapters.forEach(ch => console.log(`      ${String(ch.number).padStart(2, " ")}. ${ch.title}`));

        // Step 2: genera contenuto per ogni capitolo
        console.log("\n[2/2] Generazione contenuto capitoli...");
        for (const chapter of chapters) {
            console.log(`\n--- Inizio Capitolo ${chapter.number}: ${chapter.title} ---`);
            const content = await this._generateChapterContent(topic, chapter, chapters);
            const filename = `${String(chapter.number).padStart(2, "0")}-${slugify(chapter.title)}.md`;
            writeFile(path.join(outputDir, filename), content);
            console.log(`\n>>> Capitolo ${chapter.number} completato e salvato in (${filename})\n`);
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

    async _generateChapterSections(topic, chapter, outline) {
        const prompt = `<persona>
Sei un architetto dell'informazione e uno scrittore esperto.
</persona>

<context>
Argomento del libro: "${topic}"
Capitolo attuale: Capitolo ${chapter.number} - "${chapter.title}"
Descrizione del capitolo: ${chapter.description}
</context>

<task>
Genera una struttura logica di sotto-sezioni (paragrafi) per questo capitolo, per garantire che la trattazione sia estesa, profonda ed esplorativa.
Pianifica da 3 a 5 sotto-sezioni.
</task>

<output_format>
Rispondi ESCLUSIVAMENTE con un array JSON valido, senza markdown e senza testo discorsivo fuori dal JSON.
Formato:
[
  {
    "title": "Titolo della Sezione",
    "description": "Descrittore puntuale e dettagliato degli argomenti da sviluppare narrativamente in questa sezione."
  }
]
</output_format>`;
        
        console.log(`\n      [Pianificazione struttura interna del capitolo...]`);
        const raw = await callLLM(prompt, BOOK_SYSTEM_PROMPT, { temperature: 0.2 });
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return [{ title: "Contenuto del Capitolo", description: chapter.description }]; // fallback
        }
        return JSON.parse(jsonMatch[0]);
    }

    async _generateChapterContent(topic, chapter, outline) {
        let sections = await this._generateChapterSections(topic, chapter, outline);
        if (!Array.isArray(sections) || sections.length === 0) {
            sections = [{ title: "Trattazione Principale", description: chapter.description }];
        }

        let fullContent = `# ${chapter.title}\n\n`;
        let previousContext = "Inizio del capitolo.";

        for (let i = 0; i < sections.length; i++) {
            const sec = sections[i];
            console.log(`\n      --> Stesura sezione in corso: [${sec.title}]`);
            const isLast = (i === sections.length - 1);

            const prompt = `<persona>
Sei un autore professionista di libri e un professore universitario. Scrivi con uno stile narrativo, discorsivo, autorevole e incredibilmente dettagliato.
</persona>

<context>
Libro: "${topic}"
Capitolo: Capitolo ${chapter.number} - "${chapter.title}"
Sezione attuale che devi scrivere in modo esteso: "${sec.title}"
Obiettivi di questa sezione: ${sec.description}

Contesto narrativo precedente (le ultime frasi della sezione precedente per garantire la continuità discorsiva):
"${previousContext}"
</context>

<task>
Scrivi l'intero testo per la sezione "${sec.title}". 
Devi produrre un contenuto testuale esteso, di altissima qualitá verbale e narrativa. Non essere sbrigativo. Questa è la vera stesura del libro.

REGOLE CRITICHE:
1. Il testo DEVE essere puramente discorsivo e argomentato. Spiega accuratamente il COME, il PERCHÉ e il QUANDO di ciascun concetto.
2. VIETATI categoricamente elenchi puntati o numerati (bullet points). Usa frasi, paragrafi concatenati, e narrative per trasmettere i concetti, come in un vero libro.
3. Lo stile deve accompagnare e illuminare il lettore esplorando l'argomento in profondità, con la presenza di esempi narrati e fluidamente integrati nel testo.
${isLast ? "4. Concludi la sezione fornendo un riassunto riflessivo (ma esposto in forma discorsiva, non a elenco) e una chiusura dolce e memorabile per il capitolo." : "4. Crea un flusso fluido che chiuda la sezione e prepari concettualmente e narrativamente la transizione a quella successiva."}
</task>

<output_format>
Restituisci SOLO il contenuto descrittivo della sezione, formattato in paragrafi semplici o formattazioni base (grassetto/corsivo). NON inserire un titolo markdown per la sezione, restituisci unicamente i paragrafi che compongono la stesura. Non usare MAI markdown per liste.
</output_format>`;

            const content = await callLLM(prompt, BOOK_SYSTEM_PROMPT, { temperature: 0.8 });
            
            // Append with proper section title manually so LLM doesn't have to guess markdown heading level
            fullContent += `## ${sec.title}\n\n${content.trim()}\n\n`;

            // Extract context for the next iteration (approx last 400 chars)
            const cleanContent = content.trim();
            if (cleanContent.length > 400) {
                previousContext = "L'ultima sezione scritta terminava trattando narrativamente: " + cleanContent.slice(-400);
            } else {
                previousContext = cleanContent;
            }
        }

        return fullContent;
    }
}


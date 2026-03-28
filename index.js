#!/usr/bin/env node
import 'dotenv/config';

import { booksCommand } from "./commands/books.js";
import { exportCommand } from "./commands/export.js";
import { callLLM } from "./utils/llm.js";

const args = process.argv.slice(2);
const command = args[0];

if (command === "books") {
    booksCommand(args.slice(1)).catch(err => {
        process.stderr.write(`Errore: ${err.message}\n`);
        process.exit(1);
    });
} else if (command === "export") {
    exportCommand(args.slice(1)).catch(err => {
        process.stderr.write(`Errore: ${err.message}\n`);
        process.exit(1);
    });
} else {
    const userPrompt = args.join(" ");

    if (!userPrompt) {
        console.log(`
Uso: llm "<messaggio>"
     llm books "<argomento>" [opzioni]
     llm export [<slug-libro>]
`);
        process.exit(0);
    }

    callLLM(userPrompt).then(result => {
        process.stdout.write(result + "\n");
    }).catch(err => {
        process.stderr.write(`Chiamata API fallita: ${err.message}\n`);
        process.exit(1);
    });
}

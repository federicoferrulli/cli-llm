import { FullBookStrategy } from "../strategies/FullBookStrategy.js";
import { OutlineOnlyStrategy } from "../strategies/OutlineOnlyStrategy.js";
import { ChaptersFromOutlineStrategy } from "../strategies/ChaptersFromOutlineStrategy.js";

// Registry delle strategie: opzione CLI → classe
const STRATEGIES = {
    full:          FullBookStrategy,
    outline:       OutlineOnlyStrategy,
    "from-outline": ChaptersFromOutlineStrategy,
};

function parseArgs(args) {
    const topic = args[0];
    const options = { strategy: "full" };

    for (let i = 1; i < args.length; i++) {
        if (args[i] === "--outline-only") {
            options.strategy = "outline";
        } else if (args[i] === "--from-outline" && args[i + 1]) {
            options.strategy = "from-outline";
            options.fromOutline = args[++i];
        } else if (args[i] === "--output" && args[i + 1]) {
            options.output = args[++i];
        }
    }

    return { topic, options };
}

export async function booksCommand(args) {
    if (!args[0]) {
        console.log(`
Uso: llm books "<argomento>" [opzioni]

Opzioni:
  --outline-only              Genera solo la struttura dei capitoli (outline.json)
  --from-outline <file.json>  Genera i capitoli MD da un outline esistente
  --output <dir>              Directory di output (default: ./books/<argomento>)

Esempi:
  llm books "Intelligenza Artificiale"
  llm books "Machine Learning" --outline-only
  llm books "Machine Learning" --from-outline ./books/machine-learning/outline.json
  llm books "Python" --output ./mio-libro
`);
        process.exit(0);
    }

    const { topic, options } = parseArgs(args);
    const StrategyClass = STRATEGIES[options.strategy];
    const strategy = new StrategyClass();

    await strategy.execute(topic, options);
}

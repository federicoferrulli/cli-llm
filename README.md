# cli-llm

Un'applicazione da riga di comando (CLI) in Node.js per la generazione automatizzata di libri accademici completi e l'esportazione professionale in PDF e LaTeX.

## 🚀 Panoramica

**cli-llm** trasforma un semplice prompt in un intero libro strutturato. Utilizzando modelli linguistici locali (tramite LM Studio) o remoti (OpenAI compatibili), il tool gestisce l'intero ciclo di vita della creazione di un'opera: dalla pianificazione della struttura (outline) alla stesura narrativa dei singoli capitoli, fino alla produzione di documenti pronti per la stampa.

## ✨ Caratteristiche

* **Generazione Multi-Strategia**:
* `Full`: Genera outline e capitoli in un unico flusso.
* `OutlineOnly`: Crea solo la struttura JSON per una revisione preventiva.
* `FromOutline`: Genera i contenuti partendo da una struttura esistente.


* **Streaming & Real-time**: Visualizzazione immediata della stesura nel terminale durante la generazione.
* **Esportazione Avanzata**:
* **PDF**: Layout elegante generato tramite Puppeteer.
* **LaTeX**: Conversione accurata in formato `.tex` per pubblicazioni accademiche.


* **Stile Accademico**: Prompts ottimizzati per un tono autorevole, analitico e privo di elenchi puntati per una narrativa fluida.

## 🛠️ Requisiti

* **Node.js** (v18 o superiore).
* **LM Studio** attivo o un endpoint API OpenAI-compatibile.
* **Browser**: Google Chrome o Microsoft Edge installato (per l'export PDF).

## 📦 Installazione

1. Clona il repository.
2. Installa le dipendenze:
```bash
npm install

```


3. Configura il file `.env` (basandoti sulle indicazioni in `utils/llm.js`):
```env
LLM_BASE_URL=http://tuo-ip:1234/v1
LLM_MODEL=nome-modello

```



## 📖 Utilizzo

### Generazione di un libro

```bash
# Esecuzione completa
llm books "L'impatto della Blockchain nella Pubblica Amministrazione"

# Solo struttura
llm books "Il Machine Learning oggi" --outline-only

```

### Esportazione

```bash
# Esporta tutti i libri nella cartella books/
llm export

# Esporta un libro specifico
llm export il-machine-learning-oggi

```

## 🏗️ Struttura del Progetto

* `commands/`: Implementazione dei comandi CLI (`books`, `export`).
* `strategies/`: Logiche differenziate di generazione contenuti.
* `utils/`:
* `llm.js`: Client per la comunicazione con l'IA e gestione streaming.
* `mdToLatex.js`: Parser per la conversione Markdown -> LaTeX.
* `files.js`: Utility per la gestione del file system.

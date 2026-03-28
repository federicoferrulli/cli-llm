const BOOK_SYSTEM_PROMPT = `Sei un grande scrittore di libri e professore universitario con decenni di esperienza nell'insegnamento e nella pubblicazione accademica. Combini rigore scientifico con uno stile narrativo coinvolgente e accessibile a un pubblico colto. Quando ti viene chiesto di restituire JSON, rispondi ESCLUSIVAMENTE con il JSON valido, senza testo aggiuntivo, senza markdown, senza backtick.`;

const JARVIS_SYSTEM_PROMPT = `Sei Jarvis, un ingegnere del software senior e un assistente alla programmazione di livello esperto. Il tuo utente è un programmatore, quindi puoi utilizzare un gergo tecnico appropriato e saltare le spiegazioni per principianti, concentrandoti direttamente sulla logica avanzata. Obiettivo: Il tuo compito è fornire soluzioni architetturali, scrivere, ottimizzare e fare il debug di codice, garantendo sempre prestazioni elevate, sicurezza ed efficienza. Istruzioni Operative: Analisi e Ragionamento: Per i problemi complessi, pensa passo dopo passo e illustra brevemente la tua logica prima di fornire il codice completo. Qualità del Codice: Scrivi codice pulito, modulare e ben commentato. Includi sempre la gestione degli errori e gestisci in modo proattivo i casi limite (edge cases). Stile e Formattazione: Restituisci il codice all'interno di blocchi Markdown, specificando chiaramente il linguaggio di programmazione. Utilizza elenchi puntati per spiegare le modifiche apportate o i requisiti architetturali. Revisione Autonoma (Reflection): Prima di fornire la risposta finale, rivedi criticamente il codice che hai appena generato per individuare eventuali bug, vulnerabilità o inefficienze, fornendo direttamente la versione corretta e ottimizzata.`;

export { BOOK_SYSTEM_PROMPT, JARVIS_SYSTEM_PROMPT };

export async function callLLM(userPrompt, systemPrompt = JARVIS_SYSTEM_PROMPT, options = {}) {
    // Rimuoviamo il '/v1' finale dal base URL se presente e aggiungiamo il path nativo
    let baseUrl = process.env.LLM_BASE_URL || "http://192.168.1.68:1234/v1";
    baseUrl = baseUrl.replace(/\/v1$/, ""); // Rimuove /v1 se l'utente lo ha messo nel .env
    const apiUrl = `${baseUrl}/api/v1/chat`;
    
    const maxRetries = 3;
    let attempt = 0;

    // Logica dinamica per la temperatura se non specificata
    let temperature = options.temperature;
    if (temperature === undefined) {
        const promptLower = userPrompt.toLowerCase();
        if (promptLower.includes("json") || promptLower.includes("struttura") || promptLower.includes("<output_format>")) {
            temperature = 0.1;
        } else if (promptLower.includes("scrivi") || promptLower.includes("capitolo") || promptLower.includes("racconta")) {
            temperature = 0.8;
        } else {
            temperature = 0.3;
        }
    }

    // Payload conforme a LM Studio Native API (v1/chat)
    const payload = {
        model: process.env.LLM_MODEL || "google/gemma-3-4b",
        input: userPrompt,
        system_prompt: systemPrompt,
        temperature: temperature,
        stream: true // Abilitiamo lo streaming
    };

    while (attempt < maxRetries) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20 * 60 * 1000); 

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": "Bearer lm-studio"
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Errore HTTP: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            // Gestione dello streaming
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const dataStr = line.replace(/^data: /, "").trim();
                    if (dataStr === "[DONE]") break;

                    try {
                        const json = JSON.parse(dataStr);
                        const content = json.content || "";
                        if (content) {
                            process.stdout.write(content); // Stampa in tempo reale
                            fullText += content;
                        }
                    } catch (e) {
                        // Ignora frammenti JSON incompleti o non validi nello stream
                    }
                }
            }

            if (!fullText) {
                throw new Error("Risposta API vuota o formato non riconosciuto");
            }
            
            process.stdout.write("\n"); // A capo alla fine dello stream
            return fullText;

        } catch (err) {
            attempt++;
            const isLastAttempt = attempt === maxRetries;
            const waitTime = attempt * 2000;

            if (err.name === 'AbortError') {
                console.warn(`\n[Retry ${attempt}/${maxRetries}] Timeout raggiunto. Riprovo...`);
            } else {
                console.warn(`\n[Retry ${attempt}/${maxRetries}] Errore: ${err.message}. Riprovo...`);
            }

            if (isLastAttempt) {
                throw new Error(`Impossibile completare la chiamata dopo ${maxRetries} tentativi: ${err.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}


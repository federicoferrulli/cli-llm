const hostIp = "192.168.1.51";
const apiUrl = `http://${hostIp}:9090/v1/chat/completions`;

const BOOK_SYSTEM_PROMPT = `Sei un grande scrittore di libri e professore universitario con decenni di esperienza nell'insegnamento e nella pubblicazione accademica. Combini rigore scientifico con uno stile narrativo coinvolgente e accessibile a un pubblico colto. Quando ti viene chiesto di restituire JSON, rispondi ESCLUSIVAMENTE con il JSON valido, senza testo aggiuntivo, senza markdown, senza backtick.`;

const JARVIS_SYSTEM_PROMPT = `Sei Jarvis, un ingegnere del software senior e un assistente alla programmazione di livello esperto. Il tuo utente è un programmatore, quindi puoi utilizzare un gergo tecnico appropriato e saltare le spiegazioni per principianti, concentrandoti direttamente sulla logica avanzata. Obiettivo: Il tuo compito è fornire soluzioni architetturali, scrivere, ottimizzare e fare il debug di codice, garantendo sempre prestazioni elevate, sicurezza ed efficienza. Istruzioni Operative: Analisi e Ragionamento: Per i problemi complessi, pensa passo dopo passo e illustra brevemente la tua logica prima di fornire il codice completo. Qualità del Codice: Scrivi codice pulito, modulare e ben commentato. Includi sempre la gestione degli errori e gestisci in modo proattivo i casi limite (edge cases). Stile e Formattazione: Restituisci il codice all'interno di blocchi Markdown, specificando chiaramente il linguaggio di programmazione. Utilizza elenchi puntati per spiegare le modifiche apportate o i requisiti architetturali. Revisione Autonoma (Reflection): Prima di fornire la risposta finale, rivedi criticamente il codice che hai appena generato per individuare eventuali bug, vulnerabilità o inefficienze, fornendo direttamente la versione corretta e ottimizzata.`;

export { BOOK_SYSTEM_PROMPT, JARVIS_SYSTEM_PROMPT };

export async function callLLM(userPrompt, systemPrompt = JARVIS_SYSTEM_PROMPT, options = {}) {
    // Logica dinamica per la temperatura se non specificata
    let temperature = options.temperature;
    if (temperature === undefined) {
        const promptLower = userPrompt.toLowerCase();
        if (promptLower.includes("json") || promptLower.includes("struttura") || promptLower.includes("<output_format>")) {
            temperature = 0.1; // Molto basso per output strutturati
        } else if (promptLower.includes("scrivi") || promptLower.includes("capitolo") || promptLower.includes("racconta")) {
            temperature = 0.8; // Più alto per scrittura creativa
        } else {
            temperature = 0.3; // Default bilanciato
        }
    }

    const payload = {
        model: "google/gemma-3-4b",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: temperature,
        stream: false
    };

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Errore HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

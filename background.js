console.log("✅ BACKGROUND SCRIPT: VERSION 7.0 LOADED");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_COMPLETION') {
    
    // Use an async IIFE so we can await properly while keeping the channel open
    (async () => {
      try {
        const data = await chrome.storage.local.get(['apiKey', 'tone']);
        
        // 1. Validation
        if (!data.apiKey) {
          sendResponse({ error: "No API Key found. Please check extension settings." });
          return;
        }

        console.log("🔑 API Key used:", data.apiKey.substring(0, 5) + "...");

        // 2. Call Groq API
        const API_URL = `https://api.groq.com/openai/v1/chat/completions`;

        let systemPrompt = `You are an expert AI co-writer for WhatsApp. Your job is to strictly auto-complete the user's sentence. Only return the continuation text (max 3-5 words). Do not repeat the original text. Do not add quotes. Tone: ${data.tone || 'Casual'}.`;
        
        if (request.context) {
            systemPrompt += `\n\nRecent Chat History:\n${request.context}\n\nGiven the context above, continue what "Me" is currently typing.`;
        }

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.apiKey}`
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant", // Fast and free model
            messages: [{
                role: "system",
                content: systemPrompt
            }, {
                role: "user",
                content: request.text
            }],
            temperature: 0.3, // keep it relatively predictable
            max_tokens: 20
          })
        });

        // 3. Handle Groq Errors explicitly
        if (!response.ok) {
            const errorText = await response.text();
            console.error("🚨 GROQ ERROR (Raw):", errorText);
            
            let message = "HTTP " + response.status;
            try {
                const errorJson = JSON.parse(errorText);
                message = errorJson.error?.message || errorText;
            } catch(e) {}
            
            sendResponse({ error: message });
            return;
        }

        // 4. Handle Success
        const json = await response.json();
        
        if (json.choices && json.choices.length > 0 && json.choices[0].message) {
             const suggestion = json.choices[0].message.content.trim();
             console.log("🎉 SUCCESS! Suggestion:", suggestion);
             sendResponse({ suggestion: suggestion });
        } else {
             console.warn("⚠️ Valid response but no text.", JSON.stringify(json));
             sendResponse({ error: "AI returned no text." });
        }

      } catch (error) {
        console.error("💥 NETWORK ERROR:", error);
        sendResponse({ error: "Network Error: " + error.message });
      }
    })();

    return true; // Keep channel open
  }
});
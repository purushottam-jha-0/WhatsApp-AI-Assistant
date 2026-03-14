console.log("✅ WhatsApp Writer: Fixed Version Loaded!");

let suggestionOverlay = null;
let currentSuggestion = "";

// 1. Create the Ghost Text Overlay
function createOverlay() {
    // Remove existing if any
    const existing = document.querySelector('.ai-suggestion-overlay');
    if (existing) existing.remove();

    suggestionOverlay = document.createElement('div');
    suggestionOverlay.className = 'ai-suggestion-overlay';
    suggestionOverlay.style.position = "fixed";
    suggestionOverlay.style.pointerEvents = "none"; // Let clicks pass through
    suggestionOverlay.style.zIndex = "999999";
    
    // Better styling so it's clearly visible above the chat box
    suggestionOverlay.style.backgroundColor = "#e1f5fe"; 
    suggestionOverlay.style.color = "#000"; 
    suggestionOverlay.style.padding = "6px 12px";
    suggestionOverlay.style.borderRadius = "8px";
    suggestionOverlay.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)";
    suggestionOverlay.style.fontWeight = "bold";
    suggestionOverlay.style.fontSize = "13px";
    suggestionOverlay.style.fontFamily = "sans-serif";
    suggestionOverlay.style.display = "none"; // Hide initially
    suggestionOverlay.style.transition = "opacity 0.2s ease-in";
    
    document.body.appendChild(suggestionOverlay);
}

// 2. Position Overlay
function updateOverlayPosition(inputBox) {
    if (!suggestionOverlay) createOverlay();
    
    const rect = inputBox.getBoundingClientRect();
    
    // Position it ABOVE the text box completely, aligning left
    suggestionOverlay.style.left = rect.left + 'px'; 
    suggestionOverlay.style.top = (rect.top - 40) + 'px'; 
}

// 3. THE FIX: Use 'true' for Capture Phase
document.addEventListener('input', (e) => {
    const inputBox = e.target.closest('[contenteditable="true"], [role="textbox"]');
    if (!inputBox) return;

    console.log("⚡ Typing detected inside WhatsApp:", inputBox.innerText);
    
    // Get text safely
    const text = inputBox.innerText || inputBox.textContent || "";
    
    if (text.trim().length > 5) { // Any typing > 5 chars, wait for them to pause
            // Basic Debounce: Clear previous timer
            if (window.typingTimer) clearTimeout(window.typingTimer);
            
            // Set new timer
            window.typingTimer = setTimeout(() => {
                updateOverlayPosition(inputBox);
                fetchSuggestion(text);
            }, 1000);
    } else {
        if (suggestionOverlay) suggestionOverlay.style.display = 'none';
    }
}, true); // <--- THIS 'true' IS THE MAGIC FIX

// 4. Handle TAB Key (Also use Capture Phase)
document.addEventListener('keydown', (e) => {
    // If there is a suggestion showing and it isn't an error message
    if (suggestionOverlay && suggestionOverlay.style.display !== 'none' && currentSuggestion !== "") {
        if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation(); // Stop WhatsApp from changing focus
            
            // Use document.execCommand for native React-compatible insertion
            const textToInsert = " " + currentSuggestion;
            document.execCommand('insertText', false, textToInsert);

            suggestionOverlay.style.display = 'none';
            currentSuggestion = ""; // Reset
        } else if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            // Dismiss suggestion on escape or arrow keys
            suggestionOverlay.style.display = 'none';
            currentSuggestion = "";
        }
    }
}, true);

function getChatContext() {
    try {
        // WhatsApp specifically uses 'message-in' (them) and 'message-out' (me) classes for message bubbles
        const messageNodes = Array.from(document.querySelectorAll('div.message-in, div.message-out'));
        // Grab the last 10 messages for good context 
        const recentNodes = messageNodes.slice(-10);
        
        let contextLines = [];
        
        recentNodes.forEach(node => {
            const isMe = node.classList.contains('message-out');
            const sender = isMe ? "Me" : "Partner";
            
            // The text is typically inside a span that is selectable
            const textSpan = node.querySelector('span.selectable-text, span[dir="ltr"]');
            if (textSpan) {
                const text = textSpan.innerText || textSpan.textContent;
                if (text && text.trim().length > 0) {
                    contextLines.push(`${sender}: ${text.trim()}`);
                }
            }
        });
        
        return contextLines.join('\n');
    } catch(e) {
        console.error("Error extracting chat context:", e);
        return "";
    }
}

function fetchSuggestion(text) {
    chrome.storage.local.get(['apiKey', 'tone'], (data) => {
        if (!data.apiKey) {
            console.error("WhatsApp Writer: No API Key found.");
            if (suggestionOverlay) {
                currentSuggestion = ""; // No tab completion
                suggestionOverlay.textContent = "⚠️ Please add Groq API Key in extension!";
                suggestionOverlay.style.display = 'block';
            }
            return;
        }

        console.log("🚀 Asking Groq...");
        if (suggestionOverlay) {
            currentSuggestion = ""; // Reset
            suggestionOverlay.textContent = "⏳ Generating...";
            suggestionOverlay.style.backgroundColor = "#fff3e0"; // orangeish
            suggestionOverlay.style.display = 'block';
        }

        // Extract context right before calling the API
        const chatContext = getChatContext();
        if (chatContext) {
            console.log("📝 Chat Context Extracted:\n", chatContext);
        }

        chrome.runtime.sendMessage(
            { type: 'GET_COMPLETION', text: text, tone: data.tone || 'Casual', context: chatContext },
            (response) => {
                if (chrome.runtime.lastError) {
                     console.error("Extension Error:", chrome.runtime.lastError);
                     if(suggestionOverlay) {
                         currentSuggestion = "";
                         suggestionOverlay.textContent = "⚠️ Extension Offline. Reload WhatsApp page.";
                         suggestionOverlay.style.backgroundColor = "#ffebee"; // reddish
                         suggestionOverlay.style.display = 'block';
                     }
                     return;
                }
                
                if (response && response.suggestion) {
                    console.log("✅ Suggestion:", response.suggestion);
                    currentSuggestion = response.suggestion;
                    if(suggestionOverlay) {
                        suggestionOverlay.style.backgroundColor = "#e1f5fe"; // blueish
                        suggestionOverlay.textContent = "Press Tab ⭐ " + currentSuggestion; 
                        suggestionOverlay.style.display = 'block';
                    }
                } else if (response && response.error) {
                    console.error("API Error:", response.error);
                    if(suggestionOverlay) {
                        currentSuggestion = "";
                        suggestionOverlay.style.backgroundColor = "#ffebee"; // reddish
                        suggestionOverlay.textContent = "⚠️ Error: " + response.error;
                        suggestionOverlay.style.display = 'block';
                    }
                } else {
                    if (suggestionOverlay) suggestionOverlay.style.display = 'none';
                }
            }
        );
    });
}

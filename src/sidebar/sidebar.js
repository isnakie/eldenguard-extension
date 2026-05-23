// ─── EldenGuard Sidebar Script ───────────────────────────────────────────────

let currentUrl = "";
let pendingScreenshot = null;
let isWaiting = false;

const chatEl     = document.getElementById("chat-messages");
const inputEl    = document.getElementById("chat-input");
const sendBtn    = document.getElementById("btn-send");
const urlLabel   = document.getElementById("current-url");
const statusEl   = document.getElementById("safety-status");

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
document.getElementById("btn-check-page").addEventListener("click", () => {
  sendQuestion("Is this website safe? Please explain in simple terms.");
});

document.getElementById("btn-explain").addEventListener("click", () => {
  sendQuestion("What is this website about? Is it a legitimate site?");
});

document.getElementById("btn-screenshot").addEventListener("click", () => {
  addMessage("guard", "I'll take a screenshot and analyze what's on screen...");
  window.parent.postMessage({ type: "TAKE_SCREENSHOT" }, "*");
});

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
function sendQuestion(text) {
  if (!text.trim() || isWaiting) return;

  addMessage("user", text);
  inputEl.value = "";
  showTyping();
  isWaiting = true;
  sendBtn.disabled = true;

  const payload = { question: text, url: currentUrl };
  if (pendingScreenshot) {
    payload.screenshot = pendingScreenshot;
    pendingScreenshot = null;
    clearScreenshotPreview();
  }

  chrome.runtime.sendMessage(
    { type: "ASK_ELDENGUARD", payload },
    (response) => {
      removeTyping();
      isWaiting = false;
      sendBtn.disabled = false;

      if (response?.success) {
        addMessage("guard", response.text);
      } else {
        addMessage("guard", "Sorry, I had trouble connecting. Please try again.");
      }
    }
  );
}

sendBtn.addEventListener("click", () => sendQuestion(inputEl.value));

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendQuestion(inputEl.value);
  }
});

// ─── CHAT HELPERS ─────────────────────────────────────────────────────────────
function addMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message message--${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message__bubble";
  bubble.textContent = text;

  const time = document.createElement("span");
  time.className = "message__time";
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  wrapper.appendChild(bubble);
  wrapper.appendChild(time);
  chatEl.appendChild(wrapper);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function showTyping() {
  const indicator = document.createElement("div");
  indicator.className = "message message--guard typing-indicator";
  indicator.id = "typing";
  indicator.innerHTML = `
    <div class="message__bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  chatEl.appendChild(indicator);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

// ─── SCREENSHOT HANDLING ──────────────────────────────────────────────────────
function clearScreenshotPreview() {
  document.querySelector(".screenshot-preview")?.remove();
}

// ─── MESSAGES FROM CONTENT SCRIPT ────────────────────────────────────────────
window.addEventListener("message", (event) => {
  const { type, url, text, dataUrl } = event.data ?? {};

  if (type === "SET_URL" && url) {
    currentUrl = url;
    try {
      const hostname = new URL(url).hostname;
      urlLabel.textContent = hostname;
      urlLabel.title = url;
    } catch {
      urlLabel.textContent = url.slice(0, 40);
    }
  }

  if (type === "DISPLAY_RESPONSE" && text) {
    addMessage("guard", text);
  }

  if (type === "SCREENSHOT_READY" && dataUrl) {
    pendingScreenshot = dataUrl;
    // Show preview above input
    clearScreenshotPreview();
    const preview = document.createElement("div");
    preview.className = "screenshot-preview";
    preview.innerHTML = `
      <img src="${dataUrl}" alt="Screenshot to analyze" />
      <button class="screenshot-preview__remove" aria-label="Remove screenshot">✕</button>`;
    preview.querySelector(".screenshot-preview__remove").addEventListener("click", () => {
      pendingScreenshot = null;
      clearScreenshotPreview();
    });
    document.querySelector(".input-area").prepend(preview);
    addMessage("guard", "Got it! Ask me anything about what you see in the screenshot.");
  }
});

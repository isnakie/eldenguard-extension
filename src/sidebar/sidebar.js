// ─── EldenGuard Sidebar Script ───────────────────────────────────────────────
import { getScamAlerts } from '../utils/rss.js';

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

  window.parent.postMessage({ type: "SET_EXPRESSION", expression: "thinking" }, "*");

  chrome.runtime.sendMessage(
    { type: "ASK_ELDENGUARD", payload },
    (response) => {
      removeTyping();
      isWaiting = false;
      sendBtn.disabled = false;

      if (response?.success) {
        window.parent.postMessage({ type: "SET_EXPRESSION", expression: "happy" }, "*");
        setTimeout(() => window.parent.postMessage({ type: "SET_EXPRESSION", expression: "normal" }, "*"), 2500);
        addMessage("guard", response.text);
      } else {
        window.parent.postMessage({ type: "SET_EXPRESSION", expression: "worried" }, "*");
        setTimeout(() => window.parent.postMessage({ type: "SET_EXPRESSION", expression: "normal" }, "*"), 2500);
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

// ─── SCAM ALERTS PANEL ───────────────────────────────────────────────────────
const alertsPanel  = document.getElementById("alerts-panel");
const alertsList   = document.getElementById("alerts-list");

document.getElementById("btn-scam-alerts").addEventListener("click", () => {
  const isOpen = !alertsPanel.hidden;
  alertsPanel.hidden = isOpen;
  if (!isOpen) loadScamAlerts();
});

document.getElementById("btn-close-alerts").addEventListener("click", () => {
  alertsPanel.hidden = true;
});

function loadScamAlerts() {
  alertsList.innerHTML = '<p class="alerts-panel__loading">Loading alerts...</p>';

  getScamAlerts().then((data) => {
    if (!data?.alerts?.length) {
      alertsList.innerHTML = '<p class="alerts-panel__loading">Could not load alerts. Try again later.</p>';
      return;
    }

    const fetchedDate = new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    alertsList.innerHTML = '';

    data.alerts.forEach((alert) => {
      const item = document.createElement("a");
      item.className = "alert-item";
      item.href = alert.link;
      item.target = "_blank";
      item.rel = "noopener noreferrer";

      const pub = alert.pubDate ? new Date(alert.pubDate).toLocaleDateString() : '';

      item.innerHTML = `
        <span class="alert-item__source">${escapeHtml(alert.source)}</span>
        <span class="alert-item__title">${escapeHtml(alert.title)}</span>
        ${pub ? `<span class="alert-item__date">${pub}</span>` : ''}
      `;
      alertsList.appendChild(item);
    });

    const meta = document.createElement("p");
    meta.className = "alerts-panel__updated";
    meta.textContent = `Last updated: ${fetchedDate}`;
    alertsList.appendChild(meta);
  }).catch(() => {
    alertsList.innerHTML = '<p class="alerts-panel__loading">Could not load alerts. Try again later.</p>';
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

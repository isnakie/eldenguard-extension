// ─── EldenGuard Sidebar Script ───────────────────────────────────────────────
import { getScamAlerts } from '../utils/rss.js';

let currentUrl = "";
let isWaiting = false;
let welcomeShown = true;

const chatEl     = document.getElementById("chat-messages");
const inputEl    = document.getElementById("chat-input");
const sendBtn    = document.getElementById("btn-send");
const urlLabel   = document.getElementById("current-url");
const statusEl   = document.getElementById("safety-status");

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
const THEME_KEY = 'wiseOwlDarkMode';

chrome.storage.local.get([THEME_KEY], (result) => {
  if (result[THEME_KEY]) document.body.classList.add('dark');
});

document.getElementById('btn-theme-toggle').addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  chrome.storage.local.set({ [THEME_KEY]: isDark });
});

// ─── CLOSE BUTTON ─────────────────────────────────────────────────────────────
document.getElementById("btn-close-sidebar").addEventListener("click", () => {
  window.parent.postMessage({ type: "TOGGLE_SIDEBAR" }, "*");
});

// ─── WELCOME HERO ─────────────────────────────────────────────────────────────
function hideWelcome() {
  if (!welcomeShown) return;
  welcomeShown = false;
  const welcome = document.querySelector('.chat__welcome');
  if (welcome) {
    welcome.classList.add('welcome--hiding');
    setTimeout(() => welcome.remove(), 220);
  }
  document.querySelector('.sidebar').dataset.chatState = 'active';
}

const CHECK_PROMPT =
  "Analyze this page for safety threats. Check: (1) Is the URL legitimate or does it mimic a trusted brand? " +
  "(2) Are there urgency tactics, suspicious requests, or pressure to act fast? " +
  "(3) Are there any other red flags? Give me a clear Safe / Suspicious / Dangerous verdict with a one-sentence reason.";

const EXPLAIN_PROMPT =
  "In 2–3 sentences: what is this website, who runs it, and should I trust it? " +
  "Note any red flags in the URL or page context, or confirm it looks legitimate.";

// Hero card buttons
document.getElementById("btn-check-hero").addEventListener("click", () => sendQuestion(CHECK_PROMPT, "Check this page for safety threats"));
document.getElementById("btn-explain-hero").addEventListener("click", () => sendQuestion(EXPLAIN_PROMPT, "Explain this page"));


// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
function sendQuestion(text, displayText) {
  if (!text.trim() || isWaiting) return;

  hideWelcome();
  addMessage("user", displayText || text);
  inputEl.value = "";
  showTyping();
  isWaiting = true;
  sendBtn.disabled = true;

  const payload = { question: text, url: currentUrl };

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
const OWL_AVATAR_SVG = `
  <svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="15" r="12" fill="#8B5E3C"/>
    <circle cx="13" cy="14" r="4.5" fill="#CADCFC"/>
    <circle cx="13" cy="14" r="3" fill="#00A896"/>
    <circle cx="13" cy="14" r="1.5" fill="#3B1F0F"/>
    <circle cx="23" cy="14" r="4.5" fill="#CADCFC"/>
    <circle cx="23" cy="14" r="3" fill="#00A896"/>
    <circle cx="23" cy="14" r="1.5" fill="#3B1F0F"/>
    <path d="M15 19 L18 22 L21 19 Q18 17 15 19Z" fill="#F5A623"/>
  </svg>`;

function addMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message message--${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message__bubble";
  bubble.textContent = text;

  const time = document.createElement("span");
  time.className = "message__time";
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (role === "guard") {
    const row = document.createElement("div");
    row.className = "message__row";
    const avatar = document.createElement("div");
    avatar.className = "message__avatar";
    avatar.innerHTML = OWL_AVATAR_SVG;
    row.appendChild(avatar);
    row.appendChild(bubble);
    wrapper.appendChild(row);
  } else {
    wrapper.appendChild(bubble);
  }

  wrapper.appendChild(time);
  chatEl.appendChild(wrapper);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function showTyping() {
  const indicator = document.createElement("div");
  indicator.className = "message message--guard typing-indicator";
  indicator.id = "typing";

  const row = document.createElement("div");
  row.className = "message__row";
  const avatar = document.createElement("div");
  avatar.className = "message__avatar";
  avatar.innerHTML = OWL_AVATAR_SVG;
  const bubble = document.createElement("div");
  bubble.className = "message__bubble";
  bubble.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  row.appendChild(avatar);
  row.appendChild(bubble);
  indicator.appendChild(row);

  chatEl.appendChild(indicator);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
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
  const { type, url, text } = event.data ?? {};

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
});

// EldenGuard Content Script
// Injected into every web page. Responsible for:
//   - Rendering the floating avatar button
//   - Opening/closing the sidebar panel
//   - Showing alert banners when a threat is detected
//   - Handling the screen-grab (screenshot) flow

let sidebarOpen = false;
let sidebarFrame = null;
let avatarBtn = null;
let alertBanner = null;

// FLAGGED LINK TRACKING (url -> [{ el, html }], so unlocking restores every
// instance of a repeated link, e.g. the same scam URL in a header and footer)
const flaggedLinkOriginals = new Map();

// AVATAR BUTTON
function createAvatar() {
  if (document.getElementById("eldenguard-avatar")) return;

  avatarBtn = document.createElement("button");
  avatarBtn.id = "eldenguard-avatar";
  avatarBtn.setAttribute("aria-label", "Open EldenGuard assistant");
  avatarBtn.title = "EldenGuard - click for help";
  avatarBtn.innerHTML = `
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Owl head -->
      <circle cx="18" cy="15" r="12" fill="#0D3B6E"/>
      <!-- Eyes -->
      <circle cx="13" cy="14" r="4.5" fill="#CADCFC"/>
      <circle cx="13" cy="14" r="3" fill="#00A896"/>
      <circle id="eldenguard-pupil-left" cx="13" cy="14" r="1.5" fill="#062A52"/>
      <circle cx="14" cy="13" r="0.8" fill="white"/>
      <circle cx="23" cy="14" r="4.5" fill="#CADCFC"/>
      <circle cx="23" cy="14" r="3" fill="#00A896"/>
      <circle id="eldenguard-pupil-right" cx="23" cy="14" r="1.5" fill="#062A52"/>
      <circle cx="24" cy="13" r="0.8" fill="white"/>
      <!-- Beak -->
      <path d="M15 19 L18 22 L21 19 Q18 17 15 19Z" fill="#F5A623"/>
      <!-- Shield emblem on chest -->
      <path d="M18 26 L22 27.5 L22 32.5 Q22 35 18 36 Q14 35 14 32.5 L14 27.5 Z" fill="#00A896"/>
      <path d="M16 31 L17.5 33 L20.5 29" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  `;

  avatarBtn.addEventListener("click", toggleSidebar);
  document.body.appendChild(avatarBtn);
}

// EYE TRACKING — pupils follow the cursor within a small radius so the owl feels alive
const EYE_MAX_OFFSET = 1.4; // stay inside the iris (r=3) so pupils never poke out
const EYES = [
  { id: "eldenguard-pupil-left", baseX: 13, baseY: 14 },
  { id: "eldenguard-pupil-right", baseX: 23, baseY: 14 },
];

let lastMouseX = 0;
let lastMouseY = 0;
let eyeTrackingScheduled = false;

function updateEyeTracking() {
  eyeTrackingScheduled = false;
  if (!avatarBtn) return;

  const rect = avatarBtn.getBoundingClientRect();
  if (rect.width === 0) return; // avatar not visible/laid out yet

  EYES.forEach(({ id, baseX, baseY }) => {
    const pupil = document.getElementById(id);
    if (!pupil) return;

    // Convert the eye's position in the 36x36 SVG viewBox to viewport coordinates
    const eyeViewportX = rect.left + (baseX / 36) * rect.width;
    const eyeViewportY = rect.top + (baseY / 36) * rect.height;

    const dx = lastMouseX - eyeViewportX;
    const dy = lastMouseY - eyeViewportY;
    const distance = Math.hypot(dx, dy) || 1;

    pupil.setAttribute("cx", baseX + (dx / distance) * EYE_MAX_OFFSET);
    pupil.setAttribute("cy", baseY + (dy / distance) * EYE_MAX_OFFSET);
  });
}

document.addEventListener("mousemove", (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  if (!eyeTrackingScheduled) {
    eyeTrackingScheduled = true;
    requestAnimationFrame(updateEyeTracking);
  }
});

// SIDEBAR
function createSidebar() {
  if (document.getElementById("eldenguard-sidebar")) return;

  sidebarFrame = document.createElement("iframe");
  sidebarFrame.id = "eldenguard-sidebar";
  sidebarFrame.src = chrome.runtime.getURL("src/sidebar/sidebar.html");
  sidebarFrame.setAttribute("aria-label", "EldenGuard assistant panel");
  sidebarFrame.title = "EldenGuard";

  document.body.appendChild(sidebarFrame);
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  if (!sidebarFrame) createSidebar();

  if (sidebarOpen) {
    sidebarFrame.classList.add("open");
    avatarBtn.classList.add("active");
    avatarBtn.setAttribute("aria-expanded", "true");
    // Pass current URL to the sidebar
    setTimeout(() => {
      sidebarFrame.contentWindow?.postMessage(
        { type: "SET_URL", url: window.location.href },
        "*"
      );
    }, 100);
  } else {
    sidebarFrame.classList.remove("open");
    avatarBtn.classList.remove("active");
    avatarBtn.setAttribute("aria-expanded", "false");
  }
}

// ALERT BANNER
function showAlertBanner(level, message) {
  if (alertBanner) alertBanner.remove();

  alertBanner = document.createElement("div");
  alertBanner.id = "eldenguard-alert";
  alertBanner.setAttribute("role", "alert");
  alertBanner.setAttribute("aria-live", "assertive");
  alertBanner.className = `eldenguard-alert--${level}`;
  alertBanner.innerHTML = `
    <span class="eldenguard-alert__text">${message}</span>
    <button class="eldenguard-alert__close" aria-label="Dismiss warning">�</button>
  `;

  alertBanner.querySelector(".eldenguard-alert__close").addEventListener("click", () => {
    alertBanner.remove();
    alertBanner = null;
  });

  document.body.prepend(alertBanner);

  // Also make the avatar pulse red if it's a danger alert
  if (level === "danger" && avatarBtn) {
    avatarBtn.classList.add("danger");
  }
}

// AUTO LINK SCANNING
// Checks every external (cross-origin) link on the page against WiseOwl's safety
// check, and visually flags any that come back as a threat. Same-site navigation
// links are skipped to keep the number of checks reasonable.
function flagLink(url, elements) {
  const records = [];
  elements.forEach((el) => {
    if (el.classList.contains("eldenguard-flagged-link")) return;
    records.push({ el, html: el.innerHTML });
    el.classList.add("eldenguard-flagged-link");
    el.setAttribute("aria-disabled", "true");
    el.title = 'WiseOwl: This link may be unsafe. Right-click it and choose "Remove WiseOwl warning" to open it.';
    el.textContent = "WiseOwl detected possible malicious link here";
  });
  if (records.length) flaggedLinkOriginals.set(url, records);
}

function unlockLink(url) {
  const records = flaggedLinkOriginals.get(url);
  if (!records) return;
  records.forEach(({ el, html }) => {
    el.innerHTML = html;
    el.classList.remove("eldenguard-flagged-link");
    el.removeAttribute("aria-disabled");
    el.removeAttribute("title");
  });
  flaggedLinkOriginals.delete(url);
}

// Some sites embed hidden/duplicate <a> elements (off-screen overlays, layout
// helpers, "flip card" back-faces) that were never meant to display text.
// Skip flagging those - a user can't click something they can't see, and
// overwriting their content tends to pick up whatever odd styling (rotation,
// mirroring, zero size) was hiding them.
//
// Walk up the ancestor chain looking for a transform that mirrors the element
// on either axis. A negative `a` (horizontal scale) or `d` (vertical scale)
// component reliably signals a mirror/flip no matter which CSS function
// produced it - rotate(180deg), scaleX/Y(-1), and even 3D rotateX/Y(180deg)
// (a common "flip card" trick) all project to a negative a and/or d.
function hasFlippedAncestor(el) {
  let node = el;
  let depth = 0;
  while (node && depth < 10) {
    const t = getComputedStyle(node).transform;
    if (t && t !== "none") {
      try {
        const m = new DOMMatrix(t);
        if (m.a < -0.01 || m.d < -0.01) return true;
      } catch {
        // Unparsable transform value - ignore and keep walking up
      }
    }
    node = node.parentElement;
    depth++;
  }
  return false;
}

function isVisibleLink(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || parseFloat(style.opacity) === 0) return false;
  return !hasFlippedAncestor(el);
}

async function scanPageLinks() {
  const linksByUrl = new Map();

  document.querySelectorAll("a[href]").forEach((el) => {
    let parsed;
    try {
      parsed = new URL(el.href);
    } catch {
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    if (parsed.origin === window.location.origin) return;
    if (!isVisibleLink(el)) return;

    if (!linksByUrl.has(el.href)) linksByUrl.set(el.href, []);
    linksByUrl.get(el.href).push(el);
  });

  const urls = Array.from(linksByUrl.keys());
  if (!urls.length) return;

  const CONCURRENCY = 4;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "CHECK_URL", payload: { url } }, resolve);
        });
        if (response?.success && response.result?.isThreat) {
          flagLink(url, linksByUrl.get(url));
        }
      } catch {
        // Skip this link silently if the check fails
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
}

// Block navigation on flagged links until the user unlocks them
document.addEventListener(
  "click",
  (e) => {
    const link = e.target.closest?.("a.eldenguard-flagged-link");
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    showAlertBanner(
      "warning",
      'This link is flagged as a possible phishing link. Right-click it and choose "Remove WiseOwl warning" to open it.'
    );
  },
  true
);

// SCREENSHOT / SCREEN GRAB
// Captures the visible tab and sends it to the sidebar for analysis.
async function captureScreenshot() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
      resolve(response?.dataUrl ?? null);
    });
  });
}

// MESSAGE LISTENER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    toggleSidebar();
    sendResponse({ success: true });
  }

  if (message.type === "SHOW_ALERT") {
    showAlertBanner(message.payload.level, message.payload.message);
  }

  if (message.type === "UNLOCK_LINK" && message.payload?.url) {
    unlockLink(message.payload.url);
  }

  if (message.type === "SHOW_RESULT") {
    if (!sidebarOpen) toggleSidebar();
    setTimeout(() => {
      sidebarFrame?.contentWindow?.postMessage(
        { type: "DISPLAY_RESPONSE", text: message.payload.text },
        "*"
      );
    }, 300);
  }

  return true;
});

// Messages from the sidebar iframe
window.addEventListener("message", async (event) => {
  if (event.data?.type === "TAKE_SCREENSHOT") {
    const dataUrl = await captureScreenshot();
    sidebarFrame?.contentWindow?.postMessage(
      { type: "SCREENSHOT_READY", dataUrl },
      "*"
    );
  }
});

// INIT
createAvatar();
scanPageLinks();

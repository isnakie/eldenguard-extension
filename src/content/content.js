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
let pageIsThreat = false; // true when Safe Browsing flags the current page

// FLAGGED LINK TRACKING (url -> [{ el, html }], so unlocking restores every
// instance of a repeated link, e.g. the same scam URL in a header and footer)
const flaggedLinkOriginals = new Map();

// AVATAR BUTTON
function createAvatar() {
  if (document.getElementById("eldenguard-avatar")) return;

  avatarBtn = document.createElement("button");
  avatarBtn.id = "eldenguard-avatar";
  avatarBtn.setAttribute("aria-label", "Open WiseOwl assistant");
  avatarBtn.title = "WiseOwl - click for help";
  avatarBtn.innerHTML = `
    <svg width="47" height="47" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="translate(18,15) scale(1.2) translate(-18,-15)">
        <circle cx="18" cy="15" r="12" fill="#0D3B6E"/>
        <g class="eldenguard-eye">
          <circle cx="13" cy="14" r="4.5" fill="#CADCFC"/>
          <circle id="eldenguard-iris-left" cx="13" cy="14" r="3" fill="#00A896"/>
          <circle id="eldenguard-pupil-left" cx="13" cy="14" r="1.5" fill="#062A52"/>
        </g>
        <g class="eldenguard-eye">
          <circle cx="23" cy="14" r="4.5" fill="#CADCFC"/>
          <circle id="eldenguard-iris-right" cx="23" cy="14" r="3" fill="#00A896"/>
          <circle id="eldenguard-pupil-right" cx="23" cy="14" r="1.5" fill="#062A52"/>
        </g>
        <g id="eldenguard-eyebrows"></g>
        <path d="M15 19 L18 22 L21 19 Q18 17 15 19Z" fill="#F5A623"/>
      </g>
      <g id="eldenguard-thought-bubbles"></g>
      <path d="M18 26 L22 27.5 L22 32.5 Q22 35 18 36 Q14 35 14 32.5 L14 27.5 Z" fill="#00A896"/>
      <path d="M16 31 L17.5 33 L20.5 29" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  `;

  avatarBtn.addEventListener("click", (e) => {
    if (avatarBtn.dataset.suppressClick === "true") {
      delete avatarBtn.dataset.suppressClick;
      return;
    }
    if (avatarBtn.classList.contains("minimized")) {
      setMinimized(false);
      return;
    }
    toggleSidebar();
  });

  avatarBtn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showAvatarMenu(e.clientX, e.clientY);
  });

  document.body.appendChild(avatarBtn);

  initAvatarDragging();
  restoreAvatarPosition();
}

// DRAG TO REPOSITION
// Position is saved to chrome.storage.local so the avatar stays where the
// user put it across page loads and across every site they visit.
const AVATAR_POSITION_KEY = "wiseowlAvatarPosition";
const AVATAR_MINIMIZED_KEY = "wiseowlAvatarMinimized";
const DRAG_THRESHOLD = 4; // px of movement before a click counts as a drag

function clampAvatarPosition(left, top) {
  const rect = avatarBtn.getBoundingClientRect();
  const maxLeft = Math.max(window.innerWidth - rect.width, 0);
  const maxTop = Math.max(window.innerHeight - rect.height, 0);
  return {
    left: Math.min(Math.max(left, 0), maxLeft),
    top: Math.min(Math.max(top, 0), maxTop),
  };
}

function applyAvatarPosition(left, top) {
  avatarBtn.style.left = `${left}px`;
  avatarBtn.style.top = `${top}px`;
  avatarBtn.style.right = "auto";
  avatarBtn.style.bottom = "auto";
}

function setMinimized(minimized) {
  avatarBtn.classList.toggle("minimized", minimized);
  chrome.storage.local.set({ [AVATAR_MINIMIZED_KEY]: minimized });
}

function showAvatarMenu(x, y) {
  document.getElementById("eldenguard-context-menu")?.remove();

  const menu = document.createElement("div");
  menu.id = "eldenguard-context-menu";

  const isMinimized = avatarBtn.classList.contains("minimized");
  const label = isMinimized ? "Restore WiseOwl" : "Minimize WiseOwl";

  const item = document.createElement("button");
  item.textContent = label;
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    setMinimized(!isMinimized);
    menu.remove();
  });
  menu.appendChild(item);
  document.body.appendChild(menu);

  // Keep menu on screen
  const menuW = 160, menuH = 40;
  menu.style.left = `${Math.min(x, window.innerWidth - menuW - 8)}px`;
  menu.style.top  = `${Math.min(y, window.innerHeight - menuH - 8)}px`;

  const dismiss = () => menu.remove();
  setTimeout(() => {
    document.addEventListener("click", dismiss, { once: true });
    document.addEventListener("contextmenu", dismiss, { once: true });
    document.addEventListener("keydown", dismiss, { once: true });
  }, 0);
}

function restoreAvatarPosition() {
  chrome.storage.local.get([AVATAR_POSITION_KEY, AVATAR_MINIMIZED_KEY], (result) => {
    const saved = result[AVATAR_POSITION_KEY];
    if (saved) {
      const { left, top } = clampAvatarPosition(saved.left, saved.top);
      applyAvatarPosition(left, top);
    }
    if (result[AVATAR_MINIMIZED_KEY]) {
      avatarBtn.classList.add("minimized");
    }
  });
}

function initAvatarDragging() {
  let dragState = null;

  avatarBtn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; // left click / primary touch only
    const rect = avatarBtn.getBoundingClientRect();
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };
    avatarBtn.setPointerCapture(e.pointerId);
  });

  avatarBtn.addEventListener("pointermove", (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    if (!dragState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragState.moved = true;
      avatarBtn.classList.add("dragging");
    }

    if (dragState.moved) {
      const { left, top } = clampAvatarPosition(dragState.originLeft + dx, dragState.originTop + dy);
      applyAvatarPosition(left, top);
    }
  });

  avatarBtn.addEventListener("pointerup", (e) => {
    if (!dragState) return;
    if (dragState.moved) {
      avatarBtn.classList.remove("dragging");
      const rect = avatarBtn.getBoundingClientRect();
      chrome.storage.local.set({ [AVATAR_POSITION_KEY]: { left: rect.left, top: rect.top } });
      // The browser still fires a "click" after pointerup even though the
      // button moved under the cursor - suppress it so dragging doesn't
      // also toggle the sidebar open.
      avatarBtn.dataset.suppressClick = "true";
    }
    dragState = null;
  });

  // Keep the avatar on-screen if the window is resized after being dragged near an edge
  window.addEventListener("resize", () => {
    const rect = avatarBtn.getBoundingClientRect();
    if (avatarBtn.style.left) {
      const { left, top } = clampAvatarPosition(rect.left, rect.top);
      applyAvatarPosition(left, top);
    }
  });
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

// RANDOM BLINKING
function blinkOwl() {
  const eyes = document.querySelectorAll("#eldenguard-avatar .eldenguard-eye");
  if (!eyes.length) return;
  eyes.forEach((eye) => eye.classList.add("blinking"));
  setTimeout(() => {
    eyes.forEach((eye) => eye.classList.remove("blinking"));
  }, 120);
}

function scheduleNextBlink() {
  const delay = 2000 + Math.random() * 4000; // every 2-6s, randomized so it feels natural
  setTimeout(() => {
    blinkOwl();
    scheduleNextBlink();
  }, delay);
}

// FACIAL EXPRESSIONS
// Each expression sets iris colour, eyebrow paths, and optional thought bubbles.
// Eyebrows are in SVG-group coords (scaled head space): left eye cx=13, right eye cx=23, both cy≈14.
// Thought bubbles are in root SVG coords (viewBox 0-36).
const EXPRESSIONS = {
  normal: {
    irisColor: '#00A896',
    eyebrows: '',
    thoughtBubbles: '',
  },
  happy: {
    irisColor: '#22C55E',
    // Gently arched brows — friendly & relaxed
    eyebrows: [
      '<path d="M10.5 10.5 Q13 9 15.5 10.5" stroke="#F5A623" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
      '<path d="M20.5 10.5 Q23 9 25.5 10.5" stroke="#F5A623" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
    ].join(''),
    thoughtBubbles: '',
  },
  angry: {
    irisColor: '#DC2626',
    // Classic angry V: outer corners high, inner corners drop toward center
    eyebrows: [
      '<path d="M10.5 9.5 L15.5 12" stroke="#DC2626" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
      '<path d="M20.5 12 L25.5 9.5" stroke="#DC2626" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    ].join(''),
    thoughtBubbles: '',
  },
  worried: {
    irisColor: '#F97316',
    // Inverted V: inner corners raised, outer corners drop — concerned/sad
    eyebrows: [
      '<path d="M10.5 12 L15.5 9.5" stroke="#F5A623" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
      '<path d="M20.5 9.5 L25.5 12" stroke="#F5A623" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
    ].join(''),
    thoughtBubbles: '',
  },
  thinking: {
    irisColor: '#00A896',
    // One raised right brow — quizzical/curious
    eyebrows: '<path d="M20.5 10 Q23 8.5 25.5 10" stroke="#F5A623" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
    // Thought bubbles rising from upper-right of head (root SVG coords)
    thoughtBubbles: [
      '<circle cx="29" cy="9" r="1.3" fill="#CADCFC" opacity="0.85"/>',
      '<circle cx="31.5" cy="6" r="1" fill="#CADCFC" opacity="0.85"/>',
      '<circle cx="33.5" cy="3.5" r="0.7" fill="#CADCFC" opacity="0.85"/>',
    ].join(''),
  },
};

function setExpression(type) {
  if (!avatarBtn) return;
  const expr = EXPRESSIONS[type] || EXPRESSIONS.normal;

  const irisLeft = document.getElementById('eldenguard-iris-left');
  const irisRight = document.getElementById('eldenguard-iris-right');
  const eyebrows = document.getElementById('eldenguard-eyebrows');
  const thoughtBubbles = document.getElementById('eldenguard-thought-bubbles');

  if (irisLeft) irisLeft.setAttribute('fill', expr.irisColor);
  if (irisRight) irisRight.setAttribute('fill', expr.irisColor);
  if (eyebrows) eyebrows.innerHTML = expr.eyebrows;
  if (thoughtBubbles) thoughtBubbles.innerHTML = expr.thoughtBubbles;
}

// SIDEBAR
function createSidebar() {
  if (document.getElementById("eldenguard-sidebar")) return;

  sidebarFrame = document.createElement("iframe");
  sidebarFrame.id = "eldenguard-sidebar";
  sidebarFrame.src = chrome.runtime.getURL("src/sidebar/sidebar.html");
  sidebarFrame.setAttribute("aria-label", "WiseOwl assistant panel");
  sidebarFrame.title = "WiseOwl";

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
    <button class="eldenguard-alert__close" aria-label="Dismiss warning">✕</button>
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

  if (message.type === "SET_EXPRESSION") {
    const expr = message.payload.expression;
    if (expr === "angry") pageIsThreat = true;
    setExpression(expr);
  }

  if (message.type === "THREAT_DETECTED") {
    pageIsThreat = true;
    if (!sidebarOpen) toggleSidebar();
    // Give the sidebar iframe time to load before posting the warning
    setTimeout(() => {
      sidebarFrame?.contentWindow?.postMessage(
        { type: "DISPLAY_RESPONSE", text: message.payload.text },
        "*"
      );
    }, 500);
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

  if (event.data?.type === "SET_EXPRESSION") {
    const expr = event.data.expression;
    // Don't let chat responses reset the angry expression on a flagged page
    if (pageIsThreat && (expr === "happy" || expr === "normal")) return;
    setExpression(expr);
  }

  if (event.data?.type === "TOGGLE_SIDEBAR") {
    toggleSidebar();
  }
});

// INIT
createAvatar();
scanPageLinks();
scheduleNextBlink();

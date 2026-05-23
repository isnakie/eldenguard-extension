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
      <circle cx="13" cy="14" r="1.5" fill="#062A52"/>
      <circle cx="14" cy="13" r="0.8" fill="white"/>
      <circle cx="23" cy="14" r="4.5" fill="#CADCFC"/>
      <circle cx="23" cy="14" r="3" fill="#00A896"/>
      <circle cx="23" cy="14" r="1.5" fill="#062A52"/>
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

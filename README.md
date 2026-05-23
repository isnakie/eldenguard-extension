# EldenGuard Chrome Extension

> AI-powered browser safety co-pilot for elderly users.  
> Capstone Project · Chrome Extension · Manifest V3

---

## Project Structure

```
eldenguard-extension/
├── manifest.json                  # Extension config (MV3)
├── assets/
│   └── icons/                     # icon16.png, icon48.png, icon128.png (ADD THESE)
└── src/
    ├── background/
    │   └── service-worker.js      # URL checks, API calls, context menus
    ├── content/
    │   ├── content.js             # Avatar button + sidebar injection
    │   └── content.css            # Avatar, sidebar frame, alert banner styles
    ├── popup/
    │   └── popup.html             # Toolbar icon popup
    ├── sidebar/
    │   ├── sidebar.html           # Main chat panel
    │   ├── sidebar.css            # Sidebar styles
    │   └── sidebar.js             # Chat logic, quick actions, screenshot flow
    └── utils/
        ├── api.js                 # AWS Lambda/Bedrock API client
        └── safety.js              # Google Safe Browsing + local heuristics
```

---

## Quick Start (load unpacked in Chrome)

1. **Clone or download** this folder to your machine.

2. **Add placeholder icons** (required by Chrome — PNG files):
   ```
   assets/icons/icon16.png
   assets/icons/icon48.png
   assets/icons/icon128.png
   ```
   Use any placeholder PNG for now. We'll replace with the real owl avatar later.

3. **Open Chrome** and go to `chrome://extensions`

4. **Enable "Developer mode"** (toggle in the top-right corner)

5. Click **"Load unpacked"** → select the `eldenguard-extension/` folder

6. The EldenGuard icon should appear in your toolbar. Click it to open the popup.

---

## Configuration (before testing AI features)

### 1. AWS Lambda endpoint
Open `src/utils/api.js` and replace:
```js
const API_BASE_URL = "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com";
```
With your actual API Gateway URL after deploying the Lambda function.

### 2. Google Safe Browsing API key
Open `src/utils/safety.js` and replace:
```js
const SAFE_BROWSING_API_KEY = "YOUR_GOOGLE_SAFE_BROWSING_API_KEY";
```
Get a free key at: https://developers.google.com/safe-browsing/v4/get-started

---

## How it works

```
[Web page loads]
      ↓
[content.js injects avatar button]
      ↓
[service-worker.js checks URL via Google Safe Browsing]
      ↓
  ┌── Safe ──────────────────────────────────────────┐
  │   Avatar shows in corner, no alert               │
  └──────────────────────────────────────────────────┘
  ┌── Threat detected ───────────────────────────────┐
  │   Red banner shown at top of page                │
  │   Avatar pulses red                              │
  └──────────────────────────────────────────────────┘

[User clicks avatar]
      ↓
[Sidebar slides in from right (iframe)]
      ↓
[User types question or clicks quick action]
      ↓
[Message sent to service worker → API Gateway → Lambda → Bedrock → Claude]
      ↓
[Response displayed in sidebar chat]
```

---

## Team Responsibilities (suggested split)

| Member | Area |
|--------|------|
| A | `service-worker.js`, `api.js`, `safety.js` — backend logic |
| B | `content.js/css`, `sidebar.html/css` — UI & avatar |
| C | AWS Lambda function, Bedrock integration, scam DB |

---

## Testing Without the Lambda

Until the Lambda is deployed, you can mock the API by editing `api.js`:

```js
export async function callEldenGuardAPI({ message }) {
  // MOCK — remove when Lambda is ready
  return `[MOCK] You asked: "${message}". This is where Claude's response will appear.`;
}
```

This lets the UI team work independently of the backend.

---

## Useful Links

- [Chrome Extension MV3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [AWS Bedrock Claude Docs](https://docs.aws.amazon.com/bedrock/)
- [Google Safe Browsing API](https://developers.google.com/safe-browsing/v4/get-started)
- [Anthropic Student Credits](https://www.anthropic.com/research)

---

## Notes

- The sidebar is an **iframe** — this sandboxes it from the host page's CSS/JS, preventing styling conflicts on any website.
- All AI API calls go through the **service worker**, never directly from the sidebar or content script. This keeps the API URL out of page-accessible code.
- The extension uses **chrome.storage** (not localStorage) for any persistent settings — MV3 service workers don't have access to localStorage.

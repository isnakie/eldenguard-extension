# WiseOwl

AI-assisted browser safety co-pilot designed to help elderly and non-technical users browse the web more safely.

## Overview

WiseOwl is a Chrome Extension project focused on improving online safety and accessibility for elderly internet users.

The extension provides:
- Real-time website safety analysis
- Scam and phishing detection
- AI-assisted explanations of suspicious content
- Simplified security guidance
- Live FTC consumer scam alert feed
- Accessibility-focused browser assistance

The project is designed around a lightweight browser-extension architecture using Chrome Manifest V3.

---

# Current MVP Features

## Browser Extension
- Chrome Manifest V3 extension
- Floating assistant avatar injected into webpages
- Slide-out AI assistant sidebar

## Website Safety Analysis
- URL heuristic scanning
- Scam keyword detection
- Suspicious domain pattern detection
- Safe-domain allowlisting

## AI Assistant (LM Studio — Local)
- Powered by LM Studio local server
- Website explanation assistance
- Scam/phishing guidance
- Context-aware quick actions

## FTC Scam Alert Feed
- Pulls live consumer alerts from the FTC RSS feed (`consumer.ftc.gov`)
- Cached locally with a 1-hour TTL, refreshed hourly in the background
- Displayed as a browsable panel inside the sidebar

## Accessibility Features
- Large readable interface
- Simplified language
- Color-coded warnings
- Minimal interaction complexity

## Demo Features
- Demo phishing pages
- Suspicious form testing
- Right-click context menu analysis
- Screenshot capture workflow

---

# Project Architecture

```text
wiseowl-extension/
├── assets/
│   └── icons/
├── src/
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   ├── content.js
│   │   └── content.css
│   ├── popup/
│   │   └── popup.html
│   ├── sidebar/
│   │   ├── sidebar.html
│   │   ├── sidebar.css
│   │   └── sidebar.js
│   └── utils/
│       ├── api.js
│       ├── rss.js
│       └── safety.js
├── manifest.json
├── README.md
└── demo.html
```

---

# System Flow

```text
Webpage Loads
    ↓
Content Script Injects Avatar
    ↓
Background Service Worker Performs URL Safety Check
    ↓
User Opens Sidebar Assistant
    ↓
Messages Routed Through Service Worker
    ↓
AI (LM Studio) Generates Response
    ↓
Response Displayed In Sidebar
```

---

# Technology Stack

## Frontend
- HTML5
- CSS3
- JavaScript (ES6 Modules)

## Browser Extension
- Chrome Extension Manifest V3

## AI (Local Development)
- LM Studio (local server, port 1234)
- Compatible with any model loaded in LM Studio

## Backend
- Google Cloud Run (Node.js/Express proxy, see `backend/`)
- Google Safe Browsing API

## Security APIs
- Google Safe Browsing API (live, via Cloud Run backend proxy)
- FTC Consumer Alerts RSS Feed (live)

## Local Backend Proxy
- `backend/server.js` provides a secure proxy for Google Safe Browsing
- Store `SAFE_BROWSING_API_KEY` on the server, never in extension code
- Run the backend locally with `npm install` and `npm start`
- The extension forwards URL checks to `http://localhost:3000/api/check-url` while testing

## Deployment to Google Cloud Run
1. Install and authenticate the Google Cloud SDK.
2. Enable the Cloud Run, Cloud Build, and Secret Manager APIs.
3. In `backend/.env`, set `SAFE_BROWSING_API_KEY`.
4. Run:
   ```bash
   cd backend
   npm install
   chmod +x deploy.sh
   export SAFE_BROWSING_API_KEY="your_key_here"
   ./deploy.sh YOUR_GCP_PROJECT_ID
   ```
5. After deploy, update `src/utils/config.js` with your deployed Cloud Run URL:
   ```js
   export const BACKEND_SAFE_BROWSING_URL = 'https://<YOUR_SERVICE_ID>-<REGION>.a.run.app/api/check-url';
   ```

## Notes
- Use a production domain or Cloud Run URL in `src/utils/config.js`.
- Never commit `backend/.env` or the actual API key to source control.

---

# Installation

## 1. Clone Repository

```bash
git clone https://github.com/isnakie/eldenguard-extension.git
```

## 2. Open Chrome Extensions

Navigate to:

```text
chrome://extensions
```

Enable:
- Developer Mode

## 3. Load Extension

Click:
- Load unpacked

Select the project root folder.

## 4. Start LM Studio (for AI features)

1. Open LM Studio
2. Load any compatible model
3. Go to the **Local Server** tab and click **Start Server**
4. Server runs on `http://localhost:1234` by default

---

# Current Status

The current version uses:
- LM Studio for local AI responses
- Local heuristic scanning for URL safety
- Live FTC RSS feed for scam alerts
- Google Safe Browsing API, checked through a Cloud Run backend proxy (see `backend/`)

---

# Planned Future Features

- Voice assistance
- OCR / screenshot analysis
- Live phishing classification
- Personalized guidance mode
- Family monitoring dashboard
- Multi-browser support

---

# Security Design Notes

- AI requests are routed through the background service worker
- Sidebar runs inside an iframe sandbox
- Content script styles are namespace-prefixed to avoid collisions
- No sensitive API keys stored client-side
- Uses Chrome extension storage APIs instead of localStorage
- RSS data cached locally; no user data sent to external services

---

# Team Roles

| Area | Responsibility |
|---|---|
| Extension Architecture | Browser extension framework |
| AI Integration | API routing and LLM integration |
| Security Logic | URL heuristics and phishing detection |
| UI/UX | Accessibility-focused interface design |
| Cloud Backend | Google Cloud Run and Safe Browsing API integration |

---

# Educational Purpose

This project is developed as part of UC Berkeley's MICS capstone project and is currently intended for educational and research purposes.

---

# Contributors

- Greg Jaboin
- Greg Zhang
- Sean Sjahrial

---

# License

MIT License

# EldenGuard

AI-assisted browser safety co-pilot designed to help elderly and non-technical users browse the web more safely.

## Overview

EldenGuard is a Chrome Extension project focused on improving online safety and accessibility for elderly internet users.

The extension provides:
- Real-time website safety analysis
- Scam and phishing detection
- AI-assisted explanations of suspicious content
- Simplified security guidance
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

## AI Assistant (Mock Demo)
- Simulated AI responses
- Website explanation assistance
- Scam/phishing guidance
- Context-aware quick actions

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
eldenguard-extension/
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
AI/Mock API Generates Response
    ↓
Response Displayed In Sidebar
```

---

# Technology Stack

## Frontend
- HTML5
- CSS3
- JavaScript (ES6)

## Browser Extension
- Chrome Extension Manifest V3

## Planned Backend (If AWS Credits awarded)
- AWS Lambda
- AWS API Gateway
- Amazon Bedrock / Claude API

## Security APIs
- Google Safe Browsing API (planned)

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

---

# Current Demo Status

The current version uses:
- mock AI responses
- local heuristic scanning
- simulated safety analysis

This allows frontend and extension development without requiring cloud infrastructure deployment.

---

# Planned Future Features

- Real LLM integration
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

---

# Team Roles

| Area | Responsibility |
|---|---|
| Extension Architecture | Browser extension framework |
| AI Integration | API routing and LLM integration |
| Security Logic | URL heuristics and phishing detection |
| UI/UX | Accessibility-focused interface design |
| Cloud Backend | AWS Lambda and Bedrock integration |

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
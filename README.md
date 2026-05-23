# EldenGuard

AI-assisted browser safety co-pilot designed to help elderly and non-technical users browse the web more safely.

## Overview

EldenGuard is a Chrome Extension built as a cybersecurity capstone project focused on improving online safety and accessibility for elderly internet users.

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

This project is developed as part of a university cybersecurity capstone project and is currently intended for educational and research purposes.

---

# Contributors

- Greg Jaboin 
- Greg Zhang 
- Sean Sjahrial

---

# License

MIT License
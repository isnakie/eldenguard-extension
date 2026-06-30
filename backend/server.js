require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;
const SAFE_BROWSING_API_KEY = process.env.SAFE_BROWSING_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SAFE_BROWSING_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const SYSTEM_PROMPT = `You are EldenGuard, a friendly browser safety assistant.
Your job is to help users identify scams, phishing attempts, and unsafe websites.
Be concise and clear. When analyzing a page, focus on:
- URL legitimacy (typosquatting, suspicious TLDs, mismatched branding)
- Urgency or pressure tactics
- Requests for sensitive info (SSN, passwords, bank details)
- Trust signals (HTTPS, known domain, contact info)
Keep responses under 3 sentences unless the user asks for more detail.`;

app.use(express.json());

// Allow requests from Chrome extensions and any origin
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  const { message, url } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing message in request body.' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on backend.' });
  }

  const userMessage = url ? `Current page URL: ${url}\n\nUser: ${message}` : message;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent(userMessage);
    return res.json({ text: result.response.text() });
  } catch (err) {
    console.error('Gemini API error:', err);
    return res.status(500).json({ error: 'Unable to contact Gemini API.', details: err.message });
  }
});

app.post('/api/check-url', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url in request body.' });
  }

  if (!SAFE_BROWSING_API_KEY) {
    return res.status(500).json({
      error: 'Safe Browsing API key not configured on backend.',
      details: 'Set SAFE_BROWSING_API_KEY in the backend environment.'
    });
  }

  const body = {
    client: {
      clientId: 'wiseowl-backend',
      clientVersion: '1.0.0'
    },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION'
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }]
    }
  };

  try {
    const response = await fetch(`${SAFE_BROWSING_ENDPOINT}?key=${SAFE_BROWSING_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Safe Browsing API error',
        details: data,
        statusText: response.statusText
      });
    }

    const matches = Array.isArray(data.matches) ? data.matches : [];
    return res.json({
      isThreat: matches.length > 0,
      reason: matches.length > 0
        ? `Google Safe Browsing flagged this URL as ${matches[0].threatType.replace(/_/g, ' ')}.`
        : 'No match found by Google Safe Browsing.',
      source: 'google_safe_browsing',
      threatMatches: matches,
      rawResponse: data
    });
  } catch (err) {
    console.error('Safe Browsing backend error:', err);
    return res.status(500).json({
      error: 'Unable to contact Google Safe Browsing API.',
      details: err.message
    });
  }
});

app.listen(port, () => {
  console.log(`EldenGuard backend listening on http://localhost:${port}`);
});
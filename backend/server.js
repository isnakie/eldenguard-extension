require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;
const SAFE_BROWSING_API_KEY = process.env.SAFE_BROWSING_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SAFE_BROWSING_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const SYSTEM_PROMPT = `You are WiseOwl, a friendly browser safety owl assistant.
Your job is to help users identify scams, phishing attempts, and unsafe websites.
Be concise and clear. When analyzing a page, focus on:
- URL legitimacy (typosquatting, suspicious TLDs, mismatched branding)
- Urgency or pressure tactics
- Requests for sensitive info (SSN, passwords, bank details)
- Trust signals (HTTPS, known domain, contact info)
Keep responses under 3 sentences unless the user asks for more detail.`;

// Whitelisted onboarding-survey values. Profile data comes from the extension's own
// radio-button UI, but it still crosses a trust boundary into the LLM prompt, so we
// validate against known values rather than trusting it blindly (defense in depth).
const PROFILE_OPTIONS = {
  userRole: ['self', 'caregiver_setup'],
  techLevel: ['beginner', 'intermediate', 'advanced'],
  explanationStyle: ['simple_short', 'normal', 'detailed'],
  warningStyle: ['proactive', 'only_when_asked'],
};

const TOP_CONCERN_VALUES = [
  'phishing_email', 'fake_shopping', 'tech_support_scams', 'social_media_scams',
  'romance_scams', 'government_imposter', 'prize_lottery_scams', 'fake_charity', 'other',
];

const PROFILE_DESCRIPTIONS = {
  userRole: { self: 'the user themself', caregiver_setup: 'a trusted person setting this up on behalf of the primary user' },
  techLevel: { beginner: 'beginner — explain things simply, avoid jargon', intermediate: 'somewhat comfortable with technology', advanced: 'comfortable with technical terms' },
  explanationStyle: { simple_short: 'very simple and short', normal: 'normal, everyday language', detailed: 'detailed with technical reasons' },
  warningStyle: { proactive: 'wants proactive warnings about risky pages', only_when_asked: 'prefers to only be told when they ask' },
};

const TOP_CONCERN_DESCRIPTIONS = {
  phishing_email: 'suspicious emails, texts, or calls',
  fake_shopping: 'fake shopping or payment sites',
  tech_support_scams: 'fake tech support or pop-up warnings',
  social_media_scams: 'scams on social media',
  romance_scams: 'romance or relationship scams',
  government_imposter: 'fake IRS, Social Security, or Medicare messages',
  prize_lottery_scams: 'prize, lottery, or sweepstakes scams',
  fake_charity: 'fake charity requests',
  other: 'general online safety',
};

/** Build a personalized system instruction from a validated onboarding profile. */
function buildSystemInstruction(profile) {
  if (!profile || typeof profile !== 'object') return SYSTEM_PROMPT;

  const lines = [];
  for (const [field, allowedValues] of Object.entries(PROFILE_OPTIONS)) {
    const value = profile[field];
    if (allowedValues.includes(value)) {
      lines.push(`- ${field === 'userRole' ? 'Setup by' : field}: ${PROFILE_DESCRIPTIONS[field][value]}`);
    }
  }

  if (Array.isArray(profile.topConcerns)) {
    const concerns = profile.topConcerns
      .filter((v) => TOP_CONCERN_VALUES.includes(v))
      .map((v) => TOP_CONCERN_DESCRIPTIONS[v]);
    if (concerns.length) lines.push(`- topConcerns: ${concerns.join(', ')}`);
  }

  if (!lines.length) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\nUser profile (adjust tone, detail, and focus accordingly):\n${lines.join('\n')}`;
}

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
  const { message, url, profile } = req.body;
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
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemInstruction(profile),
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
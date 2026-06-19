require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const SAFE_BROWSING_API_KEY = process.env.SAFE_BROWSING_API_KEY;
const SAFE_BROWSING_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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

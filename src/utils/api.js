// EldenGuard API Client - LM Studio (local)
// Requires LM Studio running with local server enabled on port 1234.
// Load any model in LM Studio, then start the server under the "Local Server" tab.

const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions';

const SYSTEM_PROMPT = `You are EldenGuard, a friendly browser safety assistant.
Your job is to help users identify scams, phishing attempts, and unsafe websites.
Be concise and clear. When analyzing a page, focus on:
- URL legitimacy (typosquatting, suspicious TLDs, mismatched branding)
- Urgency or pressure tactics
- Requests for sensitive info (SSN, passwords, bank details)
- Trust signals (HTTPS, known domain, contact info)
Keep responses under 3 sentences unless the user asks for more detail.`;

/**
 * Calls the local LM Studio server for an EldenGuard response.
 * @param {Object} params
 * @param {string} params.message - User's question or auto-generated prompt
 * @param {string} params.url - Current page URL (context)
 * @param {string} [params.screenshot] - Unused for now (text-only models)
 * @returns {Promise<string>} Model response
 */
export async function callEldenGuardAPI({ message, url, screenshot = null }) {
  const userMessage = url
    ? `Current page URL: ${url}\n\nUser: ${message}`
    : message;

  let response;
  try {
    response = await fetch(LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.4,
        max_tokens: 300,
        stream: false
      })
    });
  } catch (err) {
    throw new Error(
      'Cannot reach LM Studio. Make sure the app is open and the local server is started (Local Server tab → Start Server).'
    );
  }

  if (!response.ok) {
    throw new Error(`LM Studio returned an error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? 'No response from model.';
}

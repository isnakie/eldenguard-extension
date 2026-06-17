// WiseOwl Safety Checker
// Layered architecture: local heuristics → Google Safe Browsing (when configured) → LLM (when available)
// Each layer is independent — the feature always returns a result even if upper layers are unavailable.

// Patterns commonly found in elder-targeted scam URLs
const SCAM_HEURISTICS = [
  /medicare.*update/i,
  /irs.*refund/i,
  /prize.*winner/i,
  /verify.*account.*now/i,
  /suspend.*account/i,
  /confirm.*identity.*urgent/i,
  /free.*gift.*claim/i,
  /tech.*support.*warning/i,
  /phishing/i,
  /scam/i
];

// Domains that frequently impersonate trusted services
const SUSPICIOUS_TLD_PATTERNS = [
  /paypal\.(?!com)/i,      // paypal.net, paypal.org fakes
  /amazon\.(?!com|co)/i,
  /microsoft\.(?!com)/i,
  /apple\.(?!com)/i,
];

// Known safe domains for demo
const SAFE_DOMAINS = [
  'google.com',
  'github.com',
  'stackoverflow.com',
  'wikipedia.org',
  'youtube.com',
  'amazon.com',
  'microsoft.com',
  'apple.com'
];

/**
 * Check a URL for safety using local heuristics only (no API needed for demo)
 * @param {string} url
 * @returns {Promise<{isThreat: boolean, reason: string, source: string}>}
 */
export async function checkUrlSafety(url) {
  // Simulate async check
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check if it's a known safe domain
    if (SAFE_DOMAINS.some(domain => hostname.includes(domain))) {
      return {
        isThreat: false,
        reason: "",
        source: "local_whitelist"
      };
    }

    // Check for scam patterns in URL
    for (const pattern of SCAM_HEURISTICS) {
      if (pattern.test(url)) {
        return {
          isThreat: true,
          reason: "This URL contains patterns commonly used in scam websites.",
          source: "local_heuristic"
        };
      }
    }

    // Check for suspicious domain patterns
    for (const pattern of SUSPICIOUS_TLD_PATTERNS) {
      if (pattern.test(hostname)) {
        return {
          isThreat: true,
          reason: "This site may be impersonating a trusted brand.",
          source: "local_heuristic"
        };
      }
    }

    // Default to safe for demo
    return {
      isThreat: false,
      reason: "",
      source: "local_check"
    };
  } catch (err) {
    console.error("URL safety check error:", err);
    return {
      isThreat: false,
      reason: "",
      source: "error"
    };
  }
}

// ─── GOOGLE SAFE BROWSING STUB ────────────────────────────────────────────────
// To activate: set GOOGLE_SAFE_BROWSING_API_KEY and flip SAFE_BROWSING_ENABLED.
// The function signature and return shape are already wired into analyzeLinkForContextMenu below.
const SAFE_BROWSING_ENABLED = false;
const GOOGLE_SAFE_BROWSING_API_KEY = ''; // TODO: set via environment/build config

async function checkGoogleSafeBrowsing(url) {
  if (!SAFE_BROWSING_ENABLED || !GOOGLE_SAFE_BROWSING_API_KEY) return null;

  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SAFE_BROWSING_API_KEY}`;
  const body = {
    client: { clientId: 'wiseowl-extension', clientVersion: '0.1.0' },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }],
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.matches?.length) {
      const type = data.matches[0].threatType;
      return { isThreat: true, reason: `Google Safe Browsing flagged this URL as: ${type}.`, source: 'google_safe_browsing' };
    }
    return { isThreat: false, reason: '', source: 'google_safe_browsing' };
  } catch {
    return null; // API unavailable — fall through to next layer
  }
}

// ─── LAYERED LINK ANALYZER ────────────────────────────────────────────────────

/**
 * Analyze a URL through all available safety layers and return a human-readable summary.
 * Always returns a result — upper layers are skipped gracefully if unavailable.
 *
 * Layers (in order):
 *   1. Local heuristics   — always runs, no network needed
 *   2. Google Safe Browsing — runs when SAFE_BROWSING_ENABLED + API key set
 *   3. LLM explanation    — appended when LM Studio responds; skipped silently if not
 *
 * @param {string} url
 * @param {Function} [llmFn] - optional async (message, url) => string from api.js
 * @returns {Promise<{ verdict: 'safe'|'warning'|'danger', summary: string }>}
 */
export async function analyzeLinkForContextMenu(url, llmFn = null) {
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch { /* keep raw url */ }

  // Layer 1: local heuristics
  const local = await checkUrlSafety(url);

  // Layer 2: Google Safe Browsing (no-op until enabled)
  const gsb = await checkGoogleSafeBrowsing(url);

  // Determine verdict from available hard checks
  const isThreat = local.isThreat || gsb?.isThreat;
  const verdict = isThreat ? 'danger' : 'safe';

  // Build the base summary from what we know
  let reasons = [];
  if (local.isThreat) reasons.push(local.reason);
  if (gsb?.isThreat)  reasons.push(gsb.reason);

  let summary = isThreat
    ? `⚠️ Warning — ${hostname} may be unsafe. ${reasons.join(' ')}`
    : `✅ No known threats detected for ${hostname} based on local checks.`;

  if (gsb && !gsb.isThreat && gsb.source === 'google_safe_browsing') {
    summary += ' Google Safe Browsing: clean.';
  }

  // Layer 3: LLM explanation (best-effort, non-blocking)
  if (llmFn) {
    try {
      const prompt = isThreat
        ? `This URL was flagged as potentially unsafe: ${url}. In 1-2 plain sentences, explain the risk to a non-technical user.`
        : `Briefly assess this URL in 1-2 plain sentences for a non-technical user: ${url}`;
      const llmText = await llmFn(prompt, url);
      if (llmText) summary += `\n\n${llmText}`;
    } catch {
      // LLM unavailable — base summary is still shown
    }
  }

  return { verdict, summary };
}

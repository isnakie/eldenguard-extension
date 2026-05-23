// EldenGuard Safety Checker - MOCK VERSION FOR DEMO
// This version works without Google Safe Browsing API for demo purposes

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

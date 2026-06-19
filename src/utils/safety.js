// EldenGuard Safety Checker
// Uses a backend Safe Browsing proxy plus local heuristics to verify URLs.

import { BACKEND_SAFE_BROWSING_URL } from './config.js';

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
  /paypal\.(?!com)/i,
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

async function querySafeBrowsingBackend(url) {
  console.log(`WiseOwl safe browsing backend request: ${url}`);

  const response = await fetch(BACKEND_SAFE_BROWSING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMessage = data?.error || `Backend Safe Browsing error ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  console.log('WiseOwl Safe Browsing backend response:', data);
  return data;
}

/**
 * Check a URL for safety using Google Safe Browsing and local heuristics.
 * @param {string} url
 * @returns {Promise<{isThreat: boolean, reason: string, source: string}>}
 */
export async function checkUrlSafety(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Quick local whitelist first
    if (SAFE_DOMAINS.some(domain => hostname.includes(domain))) {
      return {
        isThreat: false,
        reason: 'Known safe domain.',
        source: 'local_whitelist',
        googleChecked: false,
        googleStatus: 'skipped',
        googleError: null,
        googleResponse: null
      };
    }

    // Use backend proxy for Google Safe Browsing
    let googleInfo = {
      googleChecked: false,
      googleStatus: 'skipped',
      googleError: null,
      googleResponse: null
    };

    try {
      const apiResult = await querySafeBrowsingBackend(url);
      googleInfo = {
        googleChecked: true,
        googleStatus: 'success',
        googleError: null,
        googleResponse: apiResult.rawResponse,
        threatMatches: apiResult.threatMatches || []
      };
      // Google flagged it directly - no need to also run local heuristics
      if (apiResult.isThreat) {
        return { ...apiResult, ...googleInfo };
      }
    } catch (googleErr) {
      googleInfo = {
        googleChecked: true,
        googleStatus: 'failed',
        googleError: googleErr.message,
        googleResponse: null
      };
      console.warn('Safe Browsing backend failed, falling back to local heuristics:', googleErr.message);
    }

    // Local heuristics: run when the backend is unavailable, errors, or found no threat
    for (const pattern of SCAM_HEURISTICS) {
      if (pattern.test(url)) {
        return {
          isThreat: true,
          reason: 'This URL contains patterns commonly used in scam websites.',
          source: 'local_heuristic',
          ...googleInfo
        };
      }
    }

    for (const pattern of SUSPICIOUS_TLD_PATTERNS) {
      if (pattern.test(hostname)) {
        return {
          isThreat: true,
          reason: 'This site may be impersonating a trusted brand.',
          source: 'local_heuristic',
          ...googleInfo
        };
      }
    }

    return {
      isThreat: false,
      reason: 'No threats detected by Safe Browsing or local heuristics.',
      source: 'combined_check',
      ...googleInfo
    };
  } catch (err) {
    console.error('URL safety check error:', err);
    return {
      isThreat: false,
      reason: 'Could not evaluate this URL safely.',
      source: 'error'
    };
  }
}

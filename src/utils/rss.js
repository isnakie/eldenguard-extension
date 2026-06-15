// EldenGuard RSS Feed Utility
// Fetches and parses FTC consumer alert/blog RSS feeds.
// Results are cached in chrome.storage.local for 1 hour to avoid hammering the feed.

const FTC_FEEDS = [
  {
    label: 'Consumer Alerts',
    url: 'https://consumer.ftc.gov/consumer-alerts/rss',
  },
  {
    label: 'FTC Blog',
    url: 'https://consumer.ftc.gov/blog/rss',
  },
];

const CACHE_KEY = 'ftc_scam_alerts_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Parse an RSS XML string into a flat array of alert objects.
 * @param {string} xml
 * @param {string} feedLabel
 * @returns {{ title: string, link: string, pubDate: string, description: string, source: string }[]}
 */
function parseRSS(xml, feedLabel) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const items = Array.from(doc.querySelectorAll('item'));

  return items.map((item) => ({
    title: item.querySelector('title')?.textContent?.trim() ?? '(no title)',
    link: item.querySelector('link')?.textContent?.trim() ?? '',
    pubDate: item.querySelector('pubDate')?.textContent?.trim() ?? '',
    description: item.querySelector('description')?.textContent?.trim() ?? '',
    source: feedLabel,
  }));
}

/**
 * Fetch a single RSS feed URL and return parsed items.
 * @param {{ label: string, url: string }} feed
 * @returns {Promise<object[]>}
 */
async function fetchFeed({ label, url }) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label} feed: ${response.status}`);
  }
  const xml = await response.text();
  return parseRSS(xml, label);
}

/**
 * Return recent FTC scam alerts, using a cached copy if it's fresh enough.
 * Merges both feeds, sorted newest-first.
 * @returns {Promise<{ alerts: object[], fetchedAt: number }>}
 */
export async function getScamAlerts() {
  const cached = await chrome.storage.local.get(CACHE_KEY);
  const entry = cached[CACHE_KEY];

  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    return entry;
  }

  // Fetch all feeds; skip any that fail so one bad feed doesn't break everything
  const results = await Promise.allSettled(FTC_FEEDS.map(fetchFeed));
  const alerts = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 20); // keep top 20

  const payload = { alerts, fetchedAt: Date.now() };
  await chrome.storage.local.set({ [CACHE_KEY]: payload });
  return payload;
}

/**
 * Force a background refresh of the FTC feed cache.
 * Call this from the service worker alarm handler.
 */
export async function refreshScamAlertsCache() {
  const results = await Promise.allSettled(FTC_FEEDS.map(fetchFeed));
  const alerts = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 20);

  await chrome.storage.local.set({ [CACHE_KEY]: { alerts, fetchedAt: Date.now() } });
  console.log(`[EldenGuard] RSS cache refreshed: ${alerts.length} alerts stored.`);
}

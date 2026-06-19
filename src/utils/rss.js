// EldenGuard RSS Feed Utility
// Fetches and parses FTC consumer alert/blog RSS feeds.
// Results are cached in chrome.storage.local for 1 hour to avoid hammering the feed.

const FTC_FEEDS = [
  {
    label: 'Consumer Alerts',
    url: 'https://consumer.ftc.gov/blog/rss',
  },
];

const CACHE_KEY = 'ftc_scam_alerts_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Decode common HTML entities in a string. */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Extract the text content of the first matching XML tag.
 * Handles: plain text, CDATA, and raw/encoded HTML anchor tags inside the value.
 * Works in service worker context (no DOMParser available).
 */
function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  let content = m[1].trim();

  // Strip CDATA wrapper
  const cdata = content.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) content = cdata[1].trim();

  // FTC embeds raw <a> tags inside <title> — extract the anchor text
  const rawAnchor = content.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
  if (rawAnchor) return rawAnchor[1].trim();

  // FTC also HTML-encodes anchor tags inside field values — decode then extract
  const decoded = decodeEntities(content);
  const encodedAnchor = decoded.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
  if (encodedAnchor) return encodedAnchor[1].trim();

  return decoded;
}

/**
 * Extract a URL from an RSS item block.
 * The FTC feed embeds the real URL as an href inside the <link> content,
 * sometimes without a closing </link> tag. Decode the whole block and grab
 * the first href="https://..." value that looks like a real article path.
 */
function extractLink(block) {
  const decoded = decodeEntities(block);

  // Find all href="https://..." values in the block (handles encoded or raw anchors)
  const hrefRegex = /href="(https?:\/\/[^"]+)"/gi;
  let match;
  while ((match = hrefRegex.exec(decoded)) !== null) {
    const url = match[1];
    // Skip bare domain roots — real articles have a path beyond the hostname
    if (new URL(url).pathname.length > 1) return url;
  }

  // Atom-style <link href="..."/> or plain URL in <link>...</link>
  const atomAttr = block.match(/<link[^>]+href="(https?:\/\/[^"]+)"/i);
  if (atomAttr) return atomAttr[1];

  const plainLink = block.match(/<link[^>]*>\s*(https?:\/\/[^\s<]+)/i);
  if (plainLink) return plainLink[1];

  return '';
}

/**
 * Parse an RSS XML string into a flat array of alert objects.
 * Uses regex instead of DOMParser so it works in service worker context.
 * @param {string} xml
 * @param {string} feedLabel
 * @returns {{ title: string, link: string, pubDate: string, description: string, source: string }[]}
 */
/** Extract the href from the <a> tag inside a <title> element, if present. */
function extractTitleHref(block) {
  const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return '';
  const content = titleMatch[1].trim();
  const hrefMatch = content.match(/href="(https?:\/\/[^"]+)"/i);
  return hrefMatch ? hrefMatch[1] : '';
}

function parseRSS(xml, feedLabel) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    // FTC embeds the real article URL as the href inside <title>'s <a> tag
    const link = extractTitleHref(block) || extractLink(block);
    items.push({
      title:       extractTag(block, 'title') || '(no title)',
      link,
      pubDate:     extractTag(block, 'pubDate'),
      description: extractTag(block, 'description'),
      source:      feedLabel,
    });
  }
  return items;
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
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[EldenGuard] RSS fetch failed for "${FTC_FEEDS[i].label}" (${FTC_FEEDS[i].url}):`, r.reason);
    } else {
      console.log(`[EldenGuard] RSS "${FTC_FEEDS[i].label}": ${r.value.length} items fetched.`);
    }
  });
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
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[EldenGuard] RSS fetch failed for "${FTC_FEEDS[i].label}" (${FTC_FEEDS[i].url}):`, r.reason);
    } else {
      console.log(`[EldenGuard] RSS "${FTC_FEEDS[i].label}": ${r.value.length} items fetched.`);
    }
  });
  const alerts = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 20);

  await chrome.storage.local.set({ [CACHE_KEY]: { alerts, fetchedAt: Date.now() } });
  console.log(`[EldenGuard] RSS cache refreshed: ${alerts.length} alerts stored.`);
}

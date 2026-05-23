// EldenGuard API Client - MOCK VERSION FOR DEMO
// This is a mock version that works without AWS for demo purposes.
// Replace this with real API calls once AWS Lambda is deployed.

// Mock response database for demo purposes
const MOCK_RESPONSES = {
  safety: [
    "This website appears to be safe. I don't see any immediate red flags. However, always be careful when entering personal information.",
    "I notice this site uses secure HTTPS encryption, which is good. The domain looks legitimate.",
    "This looks like a legitimate website. The security certificate is valid and the domain has been registered for several years."
  ],
  warning: [
    "Be careful! This site is asking for sensitive information. Never give out your Social Security number or bank details unless you're absolutely sure it's legitimate.",
    "I notice several warning signs here. The URL doesn't match the company name, and they're creating urgency. This could be a scam.",
    "This looks suspicious. Real companies don't usually ask for passwords or credit card information through email links."
  ],
  help: [
    "I'm here to help! This appears to be a form asking for information. Only fill it out if you initiated this action and trust the website.",
    "Let me explain what this means: This is a cookie consent notice. Cookies are small files websites use to remember you. It's generally safe to accept.",
    "This is a login page. Make sure you see a padlock icon in your browser's address bar before entering your password."
  ],
  general: [
    "I'm EldenGuard, your browser safety assistant! I can help you identify scams, explain confusing web content, and keep you safe online.",
    "Feel free to ask me anything about the website you're viewing. I'm here to help you browse safely!",
    "If something seems suspicious or confusing, just let me know and I'll help you understand it better."
  ]
};

// Simulate API delay for realism
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock API call that simulates EldenGuard responses
 * @param {Object} params
 * @param {string} params.message  - User's question or auto-generated prompt
 * @param {string} params.url      - Current page URL (context)
 * @param {string} [params.screenshot] - Optional base64 screenshot
 * @returns {Promise<string>} Mock response simulating Claude
 */
export async function callEldenGuardAPI({ message, url, screenshot = null }) {
  // Simulate network delay (300-800ms)
  await delay(300 + Math.random() * 500);

  // Analyze the message to determine response type
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('safe') || lowerMessage.includes('check this')) {
    // Check if URL contains suspicious patterns
    if (url && (url.includes('phishing') || url.includes('scam') || url.includes('suspicious'))) {
      return MOCK_RESPONSES.warning[Math.floor(Math.random() * MOCK_RESPONSES.warning.length)];
    }
    return MOCK_RESPONSES.safety[Math.floor(Math.random() * MOCK_RESPONSES.safety.length)];
  }
  
  if (lowerMessage.includes('what') || lowerMessage.includes('explain') || lowerMessage.includes('mean')) {
    return MOCK_RESPONSES.help[Math.floor(Math.random() * MOCK_RESPONSES.help.length)];
  }
  
  if (lowerMessage.includes('suspicious') || lowerMessage.includes('scam') || lowerMessage.includes('fake')) {
    return MOCK_RESPONSES.warning[Math.floor(Math.random() * MOCK_RESPONSES.warning.length)];
  }
  
  // Default responses
  return MOCK_RESPONSES.general[Math.floor(Math.random() * MOCK_RESPONSES.general.length)];
}

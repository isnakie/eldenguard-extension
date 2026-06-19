// EldenGuard Background Service Worker
// Handles: API calls, URL safety checks, context menus, RSS feed refresh, and message routing.

import { checkUrlSafety } from "../utils/safety.js";
import { callEldenGuardAPI } from "../utils/api.js";
import { refreshScamAlertsCache } from "../utils/rss.js";

// PLAIN-LANGUAGE SAFETY MESSAGES
// Keeps technical details (source, googleStatus, threatMatches, raw responses) out of
// what's shown to users - those stay in console.log for debugging. Users only see a
// short headline, one concrete reason, and what to do about it.
const THREAT_TYPE_EXPLANATIONS = {
  MALWARE: "Google has found that this site can install harmful software on your device.",
  SOCIAL_ENGINEERING: "Google has found that this site tries to trick people into giving away personal information, like a phishing or scam page.",
  UNWANTED_SOFTWARE: "Google has found that this site installs unwanted programs.",
  POTENTIALLY_HARMFUL_APPLICATION: "Google has found that this site may be harmful to use.",
};

function describeSafetyResult(result) {
  if (!result.isThreat) {
    let reason = "Nothing suspicious turned up when we checked it.";
    if (result.source === "local_whitelist") {
      reason = "This is a well-known, trusted website.";
    } else if (result.source === "google_safe_browsing") {
      reason = "We checked it against Google's list of dangerous websites and found nothing wrong.";
    } else if (result.source === "error") {
      reason = "We weren't able to check this link right now.";
    }
    return {
      headline: "✅ This link looks safe",
      reason,
      advice: "It looks okay to visit. As always, be cautious if a site asks for personal or financial information.",
    };
  }

  let reason = "This link uses wording often seen in scam messages, like urgent account warnings or fake prizes.";
  if (result.source === "google_safe_browsing") {
    const threatType = result.threatMatches?.[0]?.threatType;
    reason = THREAT_TYPE_EXPLANATIONS[threatType] || "Google has flagged this site as dangerous.";
  } else if (result.reason?.includes("impersonating")) {
    reason = "The web address copies a trusted company's name, but it isn't that company's real website.";
  }

  return {
    headline: "⚠️ This link may not be safe",
    reason,
    advice: "We recommend not clicking this link or entering any personal information on it.",
  };
}

function formatChatMessage(result, url) {
  const { headline, reason, advice } = describeSafetyResult(result);
  return `${headline}\n\n${reason}\n\n${advice}\n\nLink checked: ${url}`;
}

function formatAlertMessage(result) {
  const { headline, reason } = describeSafetyResult(result);
  return `${headline}. ${reason}`;
}

// CONTEXT MENUS
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "wiseowlCheckLink",
      title: "Check this link with WiseOwl",
      contexts: ["link"],
    });

    chrome.contextMenus.create({
      id: "analyzeSelection",
      title: "Ask WiseOwl about this",
      contexts: ["selection"],
    });

    console.log("EldenGuard context menus created.");
  });
}

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);
createContextMenus();

// Refresh FTC RSS feed every hour in the background
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refreshScamAlerts', { periodInMinutes: 60 });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "wiseowlCheckLink") {
    try {
      const result = await checkUrlSafety(info.linkUrl);
      console.log("WiseOwl link check result:", result);

      let message = formatChatMessage(result, info.linkUrl);

      // Bonus: append a short plain-language explanation from LM Studio if it's running.
      // Silently skipped if LM Studio isn't available - the message above is already complete.
      try {
        const prompt = result.isThreat
          ? `This URL was flagged as potentially unsafe: ${info.linkUrl}. In 1-2 plain sentences, explain the risk to a non-technical user.`
          : `Briefly assess this URL in 1-2 plain sentences for a non-technical user: ${info.linkUrl}`;
        const llmText = await callEldenGuardAPI({ message: prompt, url: info.linkUrl });
        if (llmText) message += `\n\n${llmText}`;
      } catch {
        // LM Studio unavailable - plain-language message above is still shown
      }

      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_RESULT",
        payload: { text: message, context: "link_check" },
      }).catch(() => {}); // tab may not have content script
    } catch (error) {
      console.error("WiseOwl link check error:", error.message);
      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_RESULT",
        payload: { text: "WiseOwl couldn't check this link right now. Please try again in a moment." },
      }).catch(() => {});
    }
  }

  if (info.menuItemId === "analyzeSelection") {
    try {
      const result = await callEldenGuardAPI({
        message: `What does this mean? Is anything suspicious here? "${info.selectionText}"`,
        url: tab.url,
      });
      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_RESULT",
        payload: { text: result, context: "text_check" },
      });
    } catch (error) {
      console.error("EldenGuard API error:", error.message);
    }
  }
});

// URL SAFETY CHECK ON TAB UPDATE
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("about:") || tab.url.startsWith("edge://")) return;

  const safetyResult = await checkUrlSafety(tab.url);
  console.log("WiseOwl page check result:", safetyResult);

  if (safetyResult.isThreat) {
    // Alert the content script to show a warning banner
    try {
      chrome.tabs.sendMessage(tabId, {
        type: "SHOW_ALERT",
        payload: {
          level: "danger",
          message: formatAlertMessage(safetyResult),
        },
      });
      // Update the extension badge
      chrome.action.setBadgeText({ tabId, text: "!" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#DC2626" });
    } catch (error) {
      console.log("Content script not ready yet");
    }
  } else {
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});

// ALARM HANDLER
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshScamAlerts') {
    refreshScamAlertsCache().catch(console.error);
  }
});

// MESSAGE ROUTER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASK_ELDENGUARD") {
    callEldenGuardAPI({
      message: message.payload.question,
      url: message.payload.url,
    })
      .then((response) => sendResponse({ success: true, text: response }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep the message channel open for async response
  }

  if (message.type === "CHECK_URL") {
    checkUrlSafety(message.payload.url)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Handle screenshot capture
  if (message.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }
});

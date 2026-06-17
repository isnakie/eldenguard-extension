// EldenGuard Background Service Worker
// Handles: API calls, URL safety checks, context menus, RSS feed refresh, and message routing.

import { checkUrlSafety, analyzeLinkForContextMenu } from "../utils/safety.js";
import { callEldenGuardAPI } from "../utils/api.js";
import { refreshScamAlertsCache } from "../utils/rss.js";

// CONTEXT MENUS + ALARM SETUP
chrome.runtime.onInstalled.addListener(() => {
  // Refresh FTC RSS feed every hour in the background
  chrome.alarms.create('refreshScamAlerts', { periodInMinutes: 60 });

  chrome.contextMenus.create({
    id: "analyzeLink",
    title: "Check this link with WiseOwl",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    id: "analyzeSelection",
    title: "Ask WiseOwl about this",
    contexts: ["selection"],
  });

  console.log("EldenGuard installed and context menus registered.");
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzeLink") {
    // Pass the LLM function so it's used when available, skipped when not
    const { summary } = await analyzeLinkForContextMenu(info.linkUrl, async (prompt, url) => {
      return await callEldenGuardAPI({ message: prompt, url });
    });
    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_RESULT",
      payload: { text: summary, context: "link_check" },
    }).catch(() => {}); // tab may not have content script
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

  if (safetyResult.isThreat) {
    // Alert the content script to show a warning banner
    try {
      chrome.tabs.sendMessage(tabId, {
        type: "SHOW_ALERT",
        payload: {
          level: "danger",
          message: `EldenGuard Warning: This site may be unsafe. ${safetyResult.reason}`,
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

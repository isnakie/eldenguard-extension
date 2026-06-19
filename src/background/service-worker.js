// EldenGuard Background Service Worker - DEMO VERSION
// Handles: Mock API calls, URL safety checks, context menus, and message routing.

import { checkUrlSafety } from "../utils/safety.js";
import { callEldenGuardAPI } from "../utils/api.js";

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
      title: "Ask EldenGuard about this",
      contexts: ["selection"],
    });

    console.log("EldenGuard context menus created.");
  });
}

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);
createContextMenus();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "wiseowlCheckLink") {
    try {
      const result = await checkUrlSafety(info.linkUrl);
      const googleStatus = result.googleChecked
        ? `Google Safe Browsing check ${result.googleStatus}${result.googleError ? ` (${result.googleError})` : ''}`
        : 'Google Safe Browsing was not checked.';

      let message;
      if (result.source === 'google_safe_browsing') {
        message = result.isThreat
          ? `WiseOwl says this link may be unsafe according to Google Safe Browsing.\n- Threat type: ${result.threatType || 'unknown'}\n- Platform: ${result.platformType || 'ANY_PLATFORM'}\n- ${result.reason}\n- Source: ${result.source}\n${info.linkUrl}`
          : `WiseOwl says this link appears safe according to Google Safe Browsing.\n- ${result.reason}\n- Source: ${result.source}\n${info.linkUrl}`;
      } else {
        message = result.isThreat
          ? `WiseOwl says this link may be unsafe.\n- ${result.reason}\n- ${googleStatus}\n- Source: ${result.source}\n${info.linkUrl}`
          : `WiseOwl says this link appears safe.\n- ${result.reason}\n- ${googleStatus}\n- Source: ${result.source}\n${info.linkUrl}`;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_RESULT",
        payload: { text: message, context: "link_check" },
      });
    } catch (error) {
      console.error("WiseOwl link check error:", error.message);
      chrome.tabs.sendMessage(tab.id, {
        type: "SHOW_RESULT",
        payload: { text: `WiseOwl could not check that link: ${error.message}` },
      });
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

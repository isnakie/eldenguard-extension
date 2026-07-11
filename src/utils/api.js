// EldenGuard API Client - Gemini via backend
// Calls the deployed Cloud Run backend which proxies requests to Google Gemini.

import { BACKEND_CHAT_URL } from './config.js';

/**
 * Calls the EldenGuard backend Gemini endpoint.
 * @param {Object} params
 * @param {string} params.message - User's question or auto-generated prompt
 * @param {string} params.url - Current page URL (context)
 * @returns {Promise<string>} Model response
 */
export async function callEldenGuardAPI({ message, url }) {
  let response;
  try {
    response = await fetch(BACKEND_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, url })
    });
  } catch (err) {
    throw new Error('Cannot reach WiseOwl backend. Check your internet connection.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Backend error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.text?.trim() ?? 'No response from model.';
}
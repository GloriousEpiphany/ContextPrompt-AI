/**
 * ContextPrompt AI - i18n Helper
 * Runtime language switching support for Chrome extension
 * Loads locale JSON files directly instead of relying on chrome.i18n.getMessage()
 */

const localeCache = {};
let currentLocale = 'en';
let initialized = false;

/**
 * Load a locale JSON file and cache it
 */
async function loadLocale(lang) {
  if (localeCache[lang]) return localeCache[lang];
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const resp = await fetch(url);
    const data = await resp.json();
    localeCache[lang] = data;
    return data;
  } catch {
    return {};
  }
}

/**
 * Initialize i18n system: load user's preferred language
 */
export async function initI18n() {
  if (initialized) return;
  try {
    const result = await chrome.storage.local.get(['settings']);
    const lang = result?.settings?.language || 'auto';
    if (lang === 'auto') {
      currentLocale = chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
    } else {
      currentLocale = lang;
    }
  } catch {
    currentLocale = 'en';
  }
  // Preload both locales for fast switching
  await Promise.all([loadLocale('en'), loadLocale('zh')]);
  initialized = true;
}

/**
 * Get current locale code
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Set locale and re-apply translations
 */
export async function setLocale(lang) {
  if (lang === 'auto') {
    currentLocale = chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
  } else {
    currentLocale = lang;
  }
  await loadLocale(currentLocale);
  applyI18n();
}

/**
 * Translate a key, with optional substitutions
 */
export function t(key, substitutions) {
  const messages = localeCache[currentLocale] || localeCache['en'] || {};
  const entry = messages[key];
  if (!entry || !entry.message) {
    // Fallback to chrome.i18n
    try {
      const msg = chrome.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    } catch { /* ignore */ }
    return key;
  }
  let msg = entry.message;
  if (substitutions) {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    subs.forEach((sub, i) => {
      msg = msg.replace(new RegExp('\\$' + (i + 1), 'g'), sub);
    });
  }
  return msg;
}

/**
 * Apply translations to all elements with data-i18n attributes
 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const msg = t(key);
    if (msg && msg !== key) {
      el.textContent = msg;
    }
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const msg = t(key);
    if (msg && msg !== key) {
      el.placeholder = msg;
    }
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const msg = t(key);
    if (msg && msg !== key) {
      el.title = msg;
    }
  });
  // Handle data-i18n-html for innerHTML (used sparingly)
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const msg = t(key);
    if (msg && msg !== key) {
      el.innerHTML = msg;
    }
  });
}

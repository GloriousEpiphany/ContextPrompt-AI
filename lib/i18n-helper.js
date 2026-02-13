/**
 * ContextPrompt AI - i18n Helper
 * Lightweight internationalization helper for Chrome extension
 */

export function t(key, substitutions) {
  try {
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || key;
  } catch {
    return key;
  }
}

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
}

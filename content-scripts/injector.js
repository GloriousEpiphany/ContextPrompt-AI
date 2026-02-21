/**
 * ContextPrompt AI - Injector Script v3.1
 * Injects Craft Prompt button with preview panel, retry logic, history saving
 */

(function () {
  'use strict';
  if (window.__contextPromptInjectorInit) return;
  window.__contextPromptInjectorInit = true;

  // ==================== Inline i18n for content script ====================
  let _locale = 'en';
  let _messages = {};

  async function loadI18n() {
    try {
      const settings = await sendMsg({ action: 'getSettings' });
      const lang = settings?.language || 'auto';
      _locale = lang === 'auto'
        ? (navigator.language.startsWith('zh') ? 'zh' : 'en')
        : lang;
      const url = chrome.runtime.getURL(`_locales/${_locale}/messages.json`);
      const resp = await fetch(url);
      _messages = await resp.json();
    } catch { /* fallback to key */ }
  }

  function t(key) {
    const entry = _messages[key];
    if (entry && entry.message) return entry.message;
    try {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    } catch { /* ignore */ }
    return key;
  }

  const PLATFORM_CONFIGS = {
    'chat.openai.com': { name: 'ChatGPT', inputSelector: '#prompt-textarea', containerSelector: 'form', insertPosition: 'before', inputType: 'textarea' },
    'chatgpt.com': { name: 'ChatGPT', inputSelector: '#prompt-textarea', containerSelector: 'form', insertPosition: 'before', inputType: 'textarea' },
    'claude.ai': { name: 'Claude', inputSelector: '[contenteditable="true"]', containerSelector: 'fieldset, form, .composer', insertPosition: 'before', inputType: 'contenteditable' },
    'gemini.google.com': { name: 'Gemini', inputSelector: 'div[role="textbox"], rich-textarea', containerSelector: '.input-area, form', insertPosition: 'before', inputType: 'contenteditable' },
    'chat.qwen.ai': { name: '通义千问', inputSelector: 'textarea, [contenteditable="true"]', containerSelector: '.chat-input, form, .input-wrapper', insertPosition: 'before', inputType: 'auto' },
    'www.doubao.com': { name: '豆包', inputSelector: 'textarea, [contenteditable="true"], .chat-input textarea', containerSelector: '.chat-input-container, form, .input-area', insertPosition: 'before', inputType: 'auto' }
  };

  function getPlatformConfig() {
    return PLATFORM_CONFIGS[window.location.hostname] || null;
  }

  // Retry wrapper for chrome.runtime.sendMessage
  async function sendMsg(msg, retries = 1) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 500));
        return sendMsg(msg, retries - 1);
      }
      throw err;
    }
  }

  function createInjectButton() {
    const btn = document.createElement('button');
    btn.id = 'contextprompt-btn';
    btn.type = 'button';
    btn.className = 'contextprompt-inject-btn';
    btn.innerHTML = `<span class="contextprompt-icon">✨</span><span class="contextprompt-text">${t('craftPrompt')}</span>`;
    btn.title = t('craftPromptTitle');
    btn.addEventListener('click', handleButtonClick);
    return btn;
  }

  async function handleButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const btn = document.getElementById('contextprompt-btn');
    if (btn) btn.classList.add('contextprompt-loading');

    try {
      const context = await sendMsg({ action: 'getLatestContext' });
      if (!context) {
        showNotification(chrome.i18n.getMessage('noContext') || t('noContext'), 'warning');
        return;
      }
      const settings = await sendMsg({ action: 'getSettings' });
      const templates = await sendMsg({ action: 'getTemplates' });
      const template = templates.find(t => t.id === settings.defaultTemplate) || templates[0];
      const prompt = await generatePrompt(context, template, settings);

      // Show preview panel instead of direct insert
      showPreviewPanel(prompt, context, templates, settings);
    } catch (error) {
      showNotification(t('errorPrefix') + error.message, 'error');
    } finally {
      if (btn) btn.classList.remove('contextprompt-loading');
    }
  }

  // Listen for keyboard shortcut trigger
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'triggerCraftPrompt') {
      handleButtonClick(new Event('click'));
      sendResponse({ success: true });
    }
    return false;
  });

  // ==================== Preview Panel ====================

  function showPreviewPanel(prompt, context, templates, settings) {
    removePreviewPanel();
    const panel = document.createElement('div');
    panel.id = 'contextprompt-preview';
    panel.className = 'contextprompt-preview-panel';
    panel.innerHTML = `
      <div class="contextprompt-preview-header">
        <span class="contextprompt-preview-title">✨ ${t('promptPreview')}</span>
        <button class="contextprompt-preview-close" aria-label="Close">&times;</button>
      </div>
      <div class="contextprompt-preview-toolbar">
        <select class="contextprompt-template-switcher">
          ${templates.map(t => `<option value="${t.id}" ${t.id === (settings.defaultTemplate || templates[0].id) ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
      </div>
      <textarea class="contextprompt-preview-editor" rows="10">${escapeHtml(prompt)}</textarea>
      <div class="contextprompt-preview-footer">
        <button class="contextprompt-btn-cancel">${t('cancel')}</button>
        <button class="contextprompt-btn-insert">${t('insertPromptBtn')}</button>
      </div>
    `;
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));

    // Events
    panel.querySelector('.contextprompt-preview-close').addEventListener('click', removePreviewPanel);
    panel.querySelector('.contextprompt-btn-cancel').addEventListener('click', removePreviewPanel);
    panel.querySelector('.contextprompt-btn-insert').addEventListener('click', async () => {
      const text = panel.querySelector('.contextprompt-preview-editor').value;
      removePreviewPanel();
      await insertPrompt(text);
      // Save to history
      sendMsg({ action: 'savePromptHistory', data: { prompt: text, template: settings.defaultTemplate, contextTitle: context.title } }).catch(() => {});
      showNotification(chrome.i18n.getMessage('promptInserted') || t('promptInserted'), 'success');
    });
    panel.querySelector('.contextprompt-template-switcher').addEventListener('change', async (e) => {
      const newTemplate = templates.find(t => t.id === e.target.value) || templates[0];
      const newPrompt = await generatePrompt(context, newTemplate, settings);
      panel.querySelector('.contextprompt-preview-editor').value = newPrompt;
    });

    // Close on Escape
    const escHandler = (e) => { if (e.key === 'Escape') { removePreviewPanel(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  }

  function removePreviewPanel() {
    const panel = document.getElementById('contextprompt-preview');
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => panel.remove(), 300);
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ==================== Prompt Generation ====================

  async function generatePrompt(context, template, settings) {
    let prompt = template.template;

    // Build {summary}: prefer cached AI summary, then real-time AI, then NLP
    let summary;
    if (context.aiSummary) {
      summary = context.aiSummary;
    } else if (settings.aiEnabled) {
      summary = await createSummaryWithAI(context, settings);
    } else {
      summary = await createSummaryLocal(context);
    }

    // Build {content}: AI summary when AI is on, full content when off
    let contentForPrompt;
    if (context.aiSummary) {
      contentForPrompt = context.aiSummary;
    } else if (settings.aiEnabled) {
      // AI enabled but no cached summary — reuse the summary we just got
      contentForPrompt = summary.replace(/^AI Summary:\n/, '');
    } else {
      contentForPrompt = (context.mainContent || context.selection || context.description || '').substring(0, 30000);
    }

    let chatSummary = (context.chatContent)
      ? (context.aiSummary || summary)
      : t('noChatContent');

    console.log('[ContextPrompt] prompt build:', {
      templateId: template.id,
      aiEnabled: settings.aiEnabled,
      hasAiSummary: !!context.aiSummary,
      summaryLen: summary?.length,
      contentLen: contentForPrompt?.length
    });

    prompt = prompt.replace(/\{title\}/g, context.title || t('untitled'));
    prompt = prompt.replace(/\{url\}/g, context.url || '');
    prompt = prompt.replace(/\{summary\}/g, summary);
    prompt = prompt.replace(/\{content\}/g, contentForPrompt);
    prompt = prompt.replace(/\{selection\}/g, context.selection || t('noTextSelected'));
    prompt = prompt.replace(/\{query\}/g, t('typeQuestionHere'));
    prompt = prompt.replace(/\{description\}/g, context.description || '');
    prompt = prompt.replace(/\{chatSummary\}/g, chatSummary);

    if (context.isPrivateLink && !template.id.includes('chat') && context.chatContent) {
      const platformName = context.platformName || 'AI Platform';
      prompt += `\n\n⚠️ Note: Content from ${platformName} private conversation.`;
    }
    return prompt;
  }

  async function createSummaryWithAI(context, settings) {
    // Use cached AI summary if available
    if (context.aiSummary) {
      return 'AI Summary:\n' + context.aiSummary;
    }
    try {
      let content = '';
      if (context.isPrivateLink && context.chatContent) {
        content = context.chatContent;
      } else {
        content = context.mainContent || context.selection || context.description || (context.ogData && context.ogData.description) || '';
      }
      if (!content || content.length < 50) return createSummaryLocal(context);

      const result = await sendMsg({
        action: 'summarizeWithAI',
        data: { content, language: settings.language || 'auto', maxLength: 300 }
      });
      if (result && result.success && result.summary) {
        return 'AI Summary:\n' + result.summary;
      }
      return createSummaryLocal(context);
    } catch {
      return createSummaryLocal(context);
    }
  }

  async function createSummaryLocal(context) {
    // Try NLP engine via service worker
    try {
      const result = await sendMsg({ action: 'localSummarize', data: context });
      if (result && result.success && result.summary) return result.summary;
    } catch { /* fallback below */ }

    if (context.selection && context.selection.length > 50) return truncateText(context.selection, 500);
    if (context.description) return truncateText(context.description, 300);
    if (context.ogData && context.ogData.description) return truncateText(context.ogData.description, 300);
    return t('noDetailedContent');
  }

  function truncateText(text, max) {
    return text.length <= max ? text : text.substring(0, max).trim() + '...';
  }

  // ==================== Insert Prompt ====================

  async function insertPrompt(prompt) {
    const config = getPlatformConfig();
    if (!config) return;
    const input = document.querySelector(config.inputSelector);
    if (!input) throw new Error(t('inputFieldNotFound'));

    input.focus();
    const isContentEditable = input.hasAttribute('contenteditable') || input.getAttribute('contenteditable') === 'true';

    if (isContentEditable) {
      if (input.textContent.trim() === '' || input.querySelector('[data-placeholder]')) {
        input.innerHTML = '';
      }
      input.appendChild(document.createTextNode(prompt));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: prompt }));
    } else {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(input, prompt);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Select query placeholder
    const placeholder = t('typeQuestionHere');
    if (prompt.includes(placeholder)) {
      setTimeout(() => {
        if (isContentEditable) {
          const sel = window.getSelection();
          const range = document.createRange();
          const text = input.textContent;
          const start = text.indexOf(placeholder);
          if (start >= 0) {
            const walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT);
            let node, idx = 0;
            while (node = walker.nextNode()) {
              if (idx + node.textContent.length > start) {
                const offset = start - idx;
                range.setStart(node, offset);
                range.setEnd(node, offset + placeholder.length);
                sel.removeAllRanges();
                sel.addRange(range);
                break;
              }
              idx += node.textContent.length;
            }
          }
        } else {
          const start = prompt.indexOf(placeholder);
          if (start >= 0) input.setSelectionRange(start, start + placeholder.length);
        }
      }, 100);
    }
  }

  // ==================== Notification ====================

  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.contextprompt-notification');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `contextprompt-notification contextprompt-notification-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
  }

  // ==================== Injection ====================

  function injectButton() {
    const config = getPlatformConfig();
    if (!config) return;
    if (document.getElementById('contextprompt-btn')) return;
    const input = document.querySelector(config.inputSelector);
    if (!input) return;
    let container = input.closest(config.containerSelector) || input.parentElement;
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'contextprompt-btn-wrapper';
    wrapper.appendChild(createInjectButton());

    if (config.insertPosition === 'before') {
      container.insertBefore(wrapper, container.firstChild);
    } else {
      container.appendChild(wrapper);
    }
  }

  async function checkAndInject() {
    try {
      const settings = await sendMsg({ action: 'getSettings' });
      if (settings && settings.enableInjection !== false) injectButton();
    } catch { injectButton(); }
  }

  function setupObserver() {
    const observer = new MutationObserver(() => {
      if (!document.getElementById('contextprompt-btn')) checkAndInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    loadI18n().then(() => {
      checkAndInject();
      setupObserver();
      setTimeout(checkAndInject, 1000);
      setTimeout(checkAndInject, 3000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

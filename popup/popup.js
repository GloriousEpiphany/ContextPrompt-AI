/**
 * ContextPrompt AI - Popup Script v3.1
 * Full-featured popup with search, edit, export/import, history, templates, tags
 */

import { applyI18n, t } from '../lib/i18n-helper.js';

// State
let contexts = [];
let templates = [];
let settings = {};
let selectedContextIds = [];
let searchQuery = '';
let editingContextId = null;
let editingTemplateId = null;
let searchDebounceTimer = null;

// DOM cache
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  bindEvents();
  await loadData();
  applyTheme(settings.theme);

  // Listen for storage changes (e.g., AI summary completed in background)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.contexts) {
      contexts = changes.contexts.newValue || [];
      renderContextList();
    }
  });
});

function bindEvents() {
  // Main actions
  $('capture-btn').addEventListener('click', handleCapture);
  $('clear-all-btn').addEventListener('click', handleClearAll);
  $('settings-btn').addEventListener('click', () => showView('settings-view'));
  $('back-btn').addEventListener('click', () => showView('main-view'));
  $('history-btn').addEventListener('click', () => { loadHistory(); showView('history-view'); });
  $('history-back-btn').addEventListener('click', () => showView('main-view'));
  $('clear-history-btn').addEventListener('click', handleClearHistory);
  $('template-select').addEventListener('change', handleTemplateChange);
  $('fuse-btn').addEventListener('click', handleFuseContexts);

  // Search with debounce
  $('search-input').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderContextList();
    }, 300);
  });

  // Export / Import
  $('export-btn').addEventListener('click', handleExport);
  $('import-input').addEventListener('change', handleImport);

  // Template editor
  $('template-edit-btn').addEventListener('click', () => openTemplateEditor());
  $('template-modal-close').addEventListener('click', closeTemplateEditor);
  $('tmpl-cancel').addEventListener('click', closeTemplateEditor);
  $('tmpl-save').addEventListener('click', handleSaveTemplate);

  // Edit modal
  $('edit-modal-close').addEventListener('click', closeEditModal);
  $('edit-cancel').addEventListener('click', closeEditModal);
  $('edit-save').addEventListener('click', handleSaveEdit);

  // Settings
  $('enable-injection').addEventListener('change', handleSettingChange);
  $('theme-select').addEventListener('change', handleSettingChange);
  $('language-select').addEventListener('change', handleSettingChange);
  $('auto-capture')?.addEventListener('change', handleSettingChange);
  $('auto-capture-patterns')?.addEventListener('change', handleSettingChange);
  $('capture-depth')?.addEventListener('change', handleSettingChange);
  $('ai-enabled')?.addEventListener('change', handleAISettingChange);
  $('auto-summarize')?.addEventListener('change', handleAISettingChange);
  $('ai-provider')?.addEventListener('change', handleAISettingChange);
  $('ai-api-key')?.addEventListener('change', handleAISettingChange);
  $('ai-api-key')?.addEventListener('input', debounce(handleAISettingChange, 800));
  $('ai-base-url')?.addEventListener('change', handleAISettingChange);
  $('ai-base-url')?.addEventListener('input', debounce(handleAISettingChange, 800));
  $('ai-model')?.addEventListener('change', handleAISettingChange);
  $('ai-model')?.addEventListener('input', debounce(handleAISettingChange, 800));
  $('test-ai-btn')?.addEventListener('click', handleTestAI);

  // Modal backdrop click to close
  $('edit-modal').addEventListener('click', (e) => { if (e.target === $('edit-modal')) closeEditModal(); });
  $('template-modal').addEventListener('click', (e) => { if (e.target === $('template-modal')) closeTemplateEditor(); });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeTemplateEditor();
    }
  });
}

// ==================== Data Loading ====================

async function loadData() {
  try {
    contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
    templates = await chrome.runtime.sendMessage({ action: 'getTemplates' }) || [];
    settings = await chrome.runtime.sendMessage({ action: 'getSettings' }) || {};
    renderContextList();
    renderTemplates();
    applySettings();
  } catch (error) {
    showToast(t('loadFailed'), 'error');
  }
}

// ==================== View Navigation ====================

function showView(viewId) {
  ['main-view', 'settings-view', 'history-view'].forEach(id => {
    const el = $(id);
    if (el) {
      if (id === viewId) {
        el.classList.remove('hidden');
        el.style.animation = 'cp-slide-in-right var(--duration-normal) var(--ease-default)';
      } else {
        el.classList.add('hidden');
      }
    }
  });
}

// ==================== Context Rendering ====================

function renderContextList() {
  const list = $('context-list');
  let filtered = contexts;

  if (searchQuery) {
    filtered = contexts.filter(ctx =>
      (ctx.title || '').toLowerCase().includes(searchQuery) ||
      (ctx.url || '').toLowerCase().includes(searchQuery) ||
      (ctx.mainContent || '').toLowerCase().includes(searchQuery) ||
      (ctx.selection || '').toLowerCase().includes(searchQuery) ||
      (ctx.description || '').toLowerCase().includes(searchQuery) ||
      (ctx.tags || []).some(tag => tag.toLowerCase().includes(searchQuery))
    );
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <img src="../assets/illustrations/empty-contexts.svg" class="empty-illustration" alt="" width="120" height="96">
        <p class="empty-title">${searchQuery ? 'No matching contexts' : escapeHtml(t('emptyTitle'))}</p>
        <p class="empty-hint">${searchQuery ? 'Try a different search term' : escapeHtml(t('emptyHint'))}</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map((ctx, i) => `
    <div class="context-item ${selectedContextIds.includes(ctx.id) ? 'multi-selected' : ''}"
         data-id="${ctx.id}" role="listitem"
         style="animation: cp-stagger-in var(--duration-normal) var(--ease-default) ${i * 50}ms both">
      <div class="context-header">
        <span class="context-title" title="${escapeHtml(ctx.title)}">${escapeHtml(truncate(ctx.title, 38))}</span>
        <div class="context-actions">
          ${(settings.aiEnabled && !ctx.aiSummary) ? `<button class="action-btn ai-btn" data-id="${ctx.id}" title="AI Summarize" aria-label="AI Summarize">AI</button>` : ''}
          ${ctx.aiSummary ? '<span class="ai-badge">AI</span>' : ''}
          <button class="action-btn edit-btn" data-id="${ctx.id}" title="${t('edit')}" aria-label="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn delete-btn" data-id="${ctx.id}" title="${t('deleted')}" aria-label="Delete">&times;</button>
        </div>
      </div>
      <div class="context-url" title="${escapeHtml(ctx.url)}">${escapeHtml(truncateUrl(ctx.url))}</div>
      <div class="context-preview">${escapeHtml(truncate(ctx.aiSummary || ctx.mainContent || ctx.selection || ctx.description || ctx.notes || t('noContent'), 200))}</div>
      ${(ctx.tags && ctx.tags.length) ? `<div class="context-tags">${ctx.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="context-time">${formatTime(ctx.timestamp)}</div>
    </div>
  `).join('');

  // Bind events
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); handleDelete(btn.dataset.id); });
  });
  list.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(btn.dataset.id); });
  });
  list.querySelectorAll('.ai-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const res = await chrome.runtime.sendMessage({ action: 'summarizeContext', data: { id: btn.dataset.id } });
        if (res && res.success) {
          contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
          renderContextList();
          showToast('AI Summary ready', 'success');
        } else {
          showToast('AI: ' + (res?.error || 'Failed'), 'error');
          btn.textContent = 'AI';
          btn.disabled = false;
        }
      } catch (err) {
        showToast('AI: ' + err.message, 'error');
        btn.textContent = 'AI';
        btn.disabled = false;
      }
    });
  });
  list.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        toggleMultiSelect(item.dataset.id);
      } else {
        clearMultiSelect();
        selectContext(item.dataset.id);
      }
    });
  });

  updateMultiSelectHint();
}

function renderTemplates() {
  const select = $('template-select');
  select.innerHTML = templates.map(tmpl =>
    `<option value="${tmpl.id}" ${tmpl.id === settings.defaultTemplate ? 'selected' : ''}>${escapeHtml(tmpl.name)}</option>`
  ).join('');
}

// ==================== Capture ====================

async function handleCapture() {
  const btn = $('capture-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { showToast(t('noActiveTab'), 'error'); return; }
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      showToast(t('cannotCapture'), 'error'); return;
    }
    const captureOptions = { captureDepth: settings.captureDepth || 'standard' };
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'captureContext', options: captureOptions });
    } catch {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-scripts/capture.js'] });
        await new Promise(r => setTimeout(r, 200));
        response = await chrome.tabs.sendMessage(tab.id, { action: 'captureContext', options: captureOptions });
      } catch {
        showToast(t('cannotCapture'), 'error'); return;
      }
    }
    if (response && response.success) {
      const result = await chrome.runtime.sendMessage({ action: 'saveContext', data: response.context });
      if (result.success) {
        contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
        renderContextList();
        showToast(t('contextCaptured'), 'success');

        // Explicitly trigger AI summarization if enabled
        if (settings.aiEnabled && settings.autoSummarize !== false) {
          showToast('AI Summarizing...', 'info');
          try {
            const aiResult = await chrome.runtime.sendMessage({
              action: 'summarizeContext',
              data: { id: result.context.id }
            });
            if (aiResult && aiResult.success) {
              contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
              renderContextList();
              showToast('AI Summary ready', 'success');
            } else {
              showToast('AI: ' + (aiResult?.error || 'Failed'), 'error');
            }
          } catch (aiErr) {
            showToast('AI error: ' + aiErr.message, 'error');
          }
        }
      } else {
        showToast(t('saveFailed'), 'error');
      }
    } else {
      showToast(t('captureFailed'), 'error');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

// ==================== Delete / Clear ====================

async function handleDelete(id) {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'deleteContext', data: { id } });
    if (result.success) {
      contexts = contexts.filter(ctx => ctx.id !== id);
      // Animate out
      const el = document.querySelector(`.context-item[data-id="${id}"]`);
      if (el) {
        el.style.animation = 'cp-slide-in-right var(--duration-normal) var(--ease-default) reverse';
        el.addEventListener('animationend', () => renderContextList(), { once: true });
      } else {
        renderContextList();
      }
      showToast(t('deleted'), 'success');
    }
  } catch { showToast(t('deleteFailed'), 'error'); }
}

async function handleClearAll() {
  if (!confirm(t('confirmClearAll'))) return;
  try {
    const result = await chrome.runtime.sendMessage({ action: 'clearAllContexts' });
    if (result.success) {
      contexts = [];
      renderContextList();
      showToast(t('allCleared'), 'success');
    }
  } catch { showToast(t('clearFailed'), 'error'); }
}

// ==================== Edit Context ====================

function openEditModal(id) {
  const ctx = contexts.find(c => c.id === id);
  if (!ctx) return;
  editingContextId = id;
  $('edit-title').value = ctx.title || '';
  $('edit-notes').value = ctx.notes || '';
  $('edit-tags').value = (ctx.tags || []).join(', ');
  $('edit-modal').classList.remove('hidden');
  $('edit-title').focus();

  // Suggest tags
  chrome.runtime.sendMessage({ action: 'suggestTags', data: { content: ctx.selection || ctx.description || ctx.title } })
    .then(result => {
      if (result && result.success && result.tags.length) {
        $('tag-suggestions').innerHTML = result.tags.map(tag =>
          `<button class="tag-suggestion" type="button">${escapeHtml(tag)}</button>`
        ).join('');
        $('tag-suggestions').querySelectorAll('.tag-suggestion').forEach(btn => {
          btn.addEventListener('click', () => {
            const input = $('edit-tags');
            const current = input.value ? input.value.split(',').map(s => s.trim()) : [];
            if (!current.includes(btn.textContent)) {
              current.push(btn.textContent);
              input.value = current.join(', ');
            }
          });
        });
      }
    }).catch(() => {});
}

function closeEditModal() {
  $('edit-modal').classList.add('hidden');
  editingContextId = null;
  $('tag-suggestions').innerHTML = '';
}

async function handleSaveEdit() {
  if (!editingContextId) return;
  const tags = $('edit-tags').value.split(',').map(s => s.trim()).filter(Boolean);
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'updateContext',
      data: { id: editingContextId, title: $('edit-title').value, notes: $('edit-notes').value, tags }
    });
    if (result.success) {
      const idx = contexts.findIndex(c => c.id === editingContextId);
      if (idx >= 0) contexts[idx] = result.context;
      renderContextList();
      closeEditModal();
      showToast(t('updated'), 'success');
    }
  } catch { showToast(t('saveFailed'), 'error'); }
}

// ==================== Template Editor ====================

function openTemplateEditor(id) {
  editingTemplateId = id || null;
  if (id) {
    const tmpl = templates.find(t => t.id === id);
    if (tmpl) {
      $('tmpl-name').value = tmpl.name;
      $('tmpl-content').value = tmpl.template;
    }
  } else {
    $('tmpl-name').value = '';
    $('tmpl-content').value = '';
  }
  renderCustomTemplatesList();
  $('template-modal').classList.remove('hidden');
  $('tmpl-name').focus();
}

function closeTemplateEditor() {
  $('template-modal').classList.add('hidden');
  editingTemplateId = null;
}

function renderCustomTemplatesList() {
  const customTemplates = templates.filter(t => t.id.startsWith('custom_'));
  const container = $('custom-templates-list');
  if (customTemplates.length === 0) {
    container.innerHTML = '<p class="empty-hint">No custom templates yet</p>';
    return;
  }
  container.innerHTML = customTemplates.map(tmpl => `
    <div class="custom-template-item">
      <span>${escapeHtml(tmpl.name)}</span>
      <div>
        <button class="action-btn tmpl-edit" data-id="${tmpl.id}" aria-label="Edit">✏️</button>
        <button class="action-btn tmpl-delete" data-id="${tmpl.id}" aria-label="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.tmpl-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      editingTemplateId = btn.dataset.id;
      const tmpl = templates.find(t => t.id === btn.dataset.id);
      if (tmpl) { $('tmpl-name').value = tmpl.name; $('tmpl-content').value = tmpl.template; }
    });
  });
  container.querySelectorAll('.tmpl-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('confirmDeleteTemplate'))) return;
      await chrome.runtime.sendMessage({ action: 'deleteTemplate', data: { id: btn.dataset.id } });
      templates = await chrome.runtime.sendMessage({ action: 'getTemplates' }) || [];
      renderTemplates();
      renderCustomTemplatesList();
    });
  });
}

async function handleSaveTemplate() {
  const name = $('tmpl-name').value.trim();
  const template = $('tmpl-content').value.trim();
  if (!name || !template) return;
  const data = { name, template };
  if (editingTemplateId) data.id = editingTemplateId;
  await chrome.runtime.sendMessage({ action: 'saveTemplate', data });
  templates = await chrome.runtime.sendMessage({ action: 'getTemplates' }) || [];
  renderTemplates();
  renderCustomTemplatesList();
  $('tmpl-name').value = '';
  $('tmpl-content').value = '';
  editingTemplateId = null;
  showToast(t('updated'), 'success');
}

// ==================== Export / Import ====================

async function handleExport() {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'exportData' });
    if (result.success) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contextprompt-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('exportSuccess'), 'success');
    }
  } catch { showToast('Export failed', 'error'); }
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await chrome.runtime.sendMessage({ action: 'importData', data });
    if (result.success) {
      contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
      renderContextList();
      showToast(t('importSuccess').replace('$1', result.imported), 'success');
    } else {
      showToast(t('importFailed'), 'error');
    }
  } catch { showToast(t('importFailed'), 'error'); }
  e.target.value = '';
}

// ==================== History ====================

async function loadHistory() {
  const history = await chrome.runtime.sendMessage({ action: 'getPromptHistory' }) || [];
  const list = $('history-list');
  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <img src="../assets/illustrations/empty-history.svg" class="empty-illustration" alt="" width="120" height="96">
        <p class="empty-title">${t('noHistory')}</p>
      </div>`;
    return;
  }
  list.innerHTML = history.map((item, i) => `
    <div class="history-item" style="animation: cp-stagger-in var(--duration-normal) var(--ease-default) ${i * 40}ms both">
      <div class="history-header">
        <span class="history-context">${escapeHtml(truncate(item.contextTitle || 'Prompt', 30))}</span>
        <span class="history-time">${formatTime(item.timestamp)}</span>
      </div>
      <div class="history-preview">${escapeHtml(truncate(item.prompt, 120))}</div>
      <div class="history-actions">
        <button class="action-btn copy-btn" data-prompt="${escapeAttr(item.prompt)}" aria-label="Copy">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          ${t('copyPrompt')}
        </button>
        <button class="action-btn fav-btn ${item.favorite ? 'active' : ''}" data-id="${item.id}" aria-label="Favorite">
          ${item.favorite ? '★' : '☆'}
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.prompt);
      showToast(t('copied'), 'success');
    });
  });
  list.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'toggleFavorite', data: { id: btn.dataset.id } });
      loadHistory();
    });
  });
}

async function handleClearHistory() {
  if (!confirm('Clear all prompt history?')) return;
  await chrome.runtime.sendMessage({ action: 'clearPromptHistory' });
  loadHistory();
}

// ==================== Multi-Select & Fusion ====================

function selectContext(id) {
  $('context-list').querySelectorAll('.context-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.id === id);
  });
}

function toggleMultiSelect(id) {
  const idx = selectedContextIds.indexOf(id);
  if (idx > -1) selectedContextIds.splice(idx, 1);
  else selectedContextIds.push(id);
  updateMultiSelectUI();
}

function clearMultiSelect() {
  selectedContextIds = [];
  updateMultiSelectUI();
}

function updateMultiSelectUI() {
  $('context-list').querySelectorAll('.context-item').forEach(item => {
    item.classList.toggle('multi-selected', selectedContextIds.includes(item.dataset.id));
  });
  const fuseBtn = $('fuse-btn');
  if (fuseBtn) {
    fuseBtn.classList.toggle('hidden', !(selectedContextIds.length >= 2 && settings.aiEnabled));
  }
}

function updateMultiSelectHint() {
  const hint = $('multi-select-hint');
  if (hint) hint.classList.toggle('hidden', !(settings.aiEnabled && contexts.length >= 2));
}

async function handleFuseContexts() {
  if (selectedContextIds.length < 2) { showToast(t('selectAtLeast2'), 'warning'); return; }
  const fuseBtn = $('fuse-btn');
  fuseBtn.disabled = true;
  fuseBtn.textContent = '⏳ ...';
  try {
    const selected = contexts.filter(ctx => selectedContextIds.includes(ctx.id));
    const result = await chrome.runtime.sendMessage({ action: 'fuseContexts', data: { contexts: selected } });
    if (result.success) {
      await chrome.runtime.sendMessage({
        action: 'saveContext',
        data: {
          title: `🧠 Fused: ${selected.map(c => c.title).slice(0, 2).join(' + ')}`,
          url: 'fused://multiple-sources',
          selection: result.fusedContent,
          description: result.fusedContent
        }
      });
      clearMultiSelect();
      await loadData();
      showToast(t('fuseSuccess'), 'success');
    } else {
      showToast(result.error || t('fuseFailed'), 'error');
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    fuseBtn.disabled = false;
    fuseBtn.innerHTML = `🧠 <span data-i18n="fuse">${t('fuse')}</span>`;
  }
}

// ==================== Settings ====================

function applySettings() {
  $('enable-injection').checked = settings.enableInjection !== false;
  $('theme-select').value = settings.theme || 'system';
  $('language-select').value = settings.language || 'auto';
  if ($('auto-capture')) $('auto-capture').checked = settings.autoCapture || false;
  if ($('auto-capture-patterns')) $('auto-capture-patterns').value = settings.autoCapturePatterns || '';
  if ($('capture-depth')) $('capture-depth').value = settings.captureDepth || 'standard';
  if ($('ai-enabled')) $('ai-enabled').checked = settings.aiEnabled || false;
  if ($('auto-summarize')) $('auto-summarize').checked = settings.autoSummarize !== false;
  if ($('ai-provider')) $('ai-provider').value = settings.aiProvider || 'openai';
  if ($('ai-api-key')) $('ai-api-key').value = settings.aiApiKey || '';
  if ($('ai-base-url')) $('ai-base-url').value = settings.aiBaseUrl || '';
  if ($('ai-model')) $('ai-model').value = settings.aiModel || 'gpt-4o-mini';
  updateAISettingsVisibility();
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }
}

async function handleSettingChange() {
  settings.enableInjection = $('enable-injection').checked;
  settings.theme = $('theme-select').value;
  settings.language = $('language-select').value;
  settings.captureDepth = $('capture-depth')?.value || 'standard';
  settings.autoCapture = $('auto-capture')?.checked || false;
  settings.autoCapturePatterns = $('auto-capture-patterns')?.value || '';
  applyTheme(settings.theme);
  await saveSettings();
}

async function handleAISettingChange() {
  const wantsAI = $('ai-enabled')?.checked || false;
  settings.autoSummarize = $('auto-summarize')?.checked ?? true;
  settings.aiProvider = $('ai-provider')?.value || 'openai';
  settings.aiApiKey = $('ai-api-key')?.value || '';
  settings.aiBaseUrl = $('ai-base-url')?.value || '';
  settings.aiModel = $('ai-model')?.value || 'gpt-4o-mini';

  // Request API endpoint permission when enabling AI
  if (wantsAI && !settings.aiEnabled) {
    const origin = getAPIOrigin(settings.aiProvider, settings.aiBaseUrl);
    if (origin) {
      try {
        const granted = await chrome.permissions.request({ origins: [origin] });
        settings.aiEnabled = granted;
        if ($('ai-enabled')) $('ai-enabled').checked = granted;
        if (!granted) {
          showToast('Permission denied — AI features require API access', 'error');
        }
      } catch {
        settings.aiEnabled = false;
        if ($('ai-enabled')) $('ai-enabled').checked = false;
      }
    } else {
      settings.aiEnabled = true;
    }
  } else {
    settings.aiEnabled = wantsAI;
  }

  updateAISettingsVisibility();
  await saveSettings();
}

function getAPIOrigin(provider, customUrl) {
  const origins = {
    openai: 'https://api.openai.com/*',
    deepseek: 'https://api.deepseek.com/*',
    anthropic: 'https://api.anthropic.com/*',
    qwen: 'https://dashscope.aliyuncs.com/*'
  };
  if (provider === 'custom' && customUrl) {
    try {
      const url = new URL(customUrl);
      return url.origin + '/*';
    } catch { return null; }
  }
  return origins[provider] || null;
}

function updateAISettingsVisibility() {
  const isEnabled = settings.aiEnabled || false;
  const isCustom = settings.aiProvider === 'custom';
  document.querySelectorAll('.ai-settings').forEach(el => {
    el.style.opacity = isEnabled ? '1' : '0.5';
    el.style.pointerEvents = isEnabled ? 'auto' : 'none';
  });
  document.querySelectorAll('.ai-custom-only').forEach(el => {
    el.classList.toggle('hidden', !(isEnabled && isCustom));
  });
  updateModelSuggestions();
}

function updateModelSuggestions() {
  const datalist = $('ai-model-list');
  if (!datalist) return;
  const models = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4-turbo'],
    deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
    custom: []
  };
  datalist.innerHTML = (models[settings.aiProvider] || []).map(m => `<option value="${m}">`).join('');
}

async function handleTestAI() {
  const btn = $('test-ai-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = t('testing');
  try {
    const result = await chrome.runtime.sendMessage({ action: 'testAIConnection' });
    showToast(result.success ? t('connectionSuccess') : (result.error || t('connectionFailed')), result.success ? 'success' : 'error');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('testConnection');
  }
}

async function handleTemplateChange() {
  settings.defaultTemplate = $('template-select').value;
  await saveSettings();
}

async function saveSettings() {
  try {
    await chrome.runtime.sendMessage({ action: 'saveSettings', data: settings });
  } catch { /* ignore */ }
}

// ==================== Utilities ====================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text, max) {
  if (!text) return '';
  return text.length <= max ? text : text.substring(0, max) + '...';
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function truncateUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    let result = parsed.hostname + parsed.pathname;
    return result.length > 42 ? result.substring(0, 42) + '...' : result;
  } catch { return truncate(url, 42); }
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return t('justNow');
  if (diff < 3600000) return t('minAgo').replace('$1', Math.floor(diff / 60000));
  if (diff < 86400000) return t('hrAgo').replace('$1', Math.floor(diff / 3600000));
  return new Date(timestamp).toLocaleDateString();
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.animation = 'cp-toast-in var(--duration-slow) var(--ease-spring) forwards';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(12px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

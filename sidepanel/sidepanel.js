/**
 * ContextPrompt AI - Side Panel v3.1
 * Full-featured panel with context management, prompt library, history, quality radar
 */

import { PROMPT_CATEGORIES } from '../lib/prompt-library.js';
import { initI18n, applyI18n, t } from '../lib/i18n-helper.js';

const $ = id => document.getElementById(id);
let contexts = [], history = [], settings = {};
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  applyI18n();
  applyTheme();
  bindTabs();
  bindEvents();
  await loadData();
  renderContexts();
  renderLibrary();

  // Listen for storage changes (e.g., AI summary completed in background)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.contexts) {
      contexts = changes.contexts.newValue || [];
      renderContexts();
    }
  });
});

function applyTheme() {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function bindTabs() {
  document.querySelectorAll('.sp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sp-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      document.querySelectorAll('.sp-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      $(`panel-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });
}

function bindEvents() {
  $('sp-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderContexts();
  });
  $('sp-analyze-btn').addEventListener('click', analyzeQuality);
  $('sp-clear-history').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearPromptHistory' });
    loadHistory();
  });
}

async function loadData() {
  contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
  settings = await chrome.runtime.sendMessage({ action: 'getSettings' }) || {};
}

// ==================== Contexts ====================

function renderContexts() {
  const list = $('sp-context-list');
  let filtered = contexts;
  if (searchQuery) {
    filtered = contexts.filter(c =>
      (c.title || '').toLowerCase().includes(searchQuery) ||
      (c.url || '').toLowerCase().includes(searchQuery) ||
      (c.mainContent || '').toLowerCase().includes(searchQuery) ||
      (c.tags || []).some(t => t.toLowerCase().includes(searchQuery))
    );
  }
  if (filtered.length === 0) {
    list.innerHTML = `<div class="sp-empty"><img src="../assets/illustrations/empty-contexts.svg" width="100" alt=""><p>${t('noContextsFound')}</p></div>`;
    return;
  }
  list.innerHTML = filtered.map((ctx, i) => {
    // Show mainContent preview — this is the full captured article
    const preview = ctx.aiSummary || ctx.mainContent || ctx.selection || ctx.description || ctx.notes || '';
    return `
    <div class="sp-item" data-id="${ctx.id}" style="animation: cp-stagger-in var(--duration-normal) var(--ease-default) ${i * 40}ms both">
      <div class="sp-item-title">${esc(truncate(ctx.title, 50))}</div>
      <div class="sp-item-meta">${esc(truncateUrl(ctx.url))} · ${formatTime(ctx.timestamp)}${ctx.mainContent ? ' · ' + formatSize(ctx.mainContent.length) : ''}</div>
      <div class="sp-item-preview">${esc(truncate(preview, 200))}</div>
      ${(ctx.tags && ctx.tags.length) ? `<div class="sp-item-tags">${ctx.tags.map(t => `<span class="sp-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="sp-item-actions">
        <button class="sp-action-btn sp-view" data-id="${ctx.id}">${t('viewFull')}</button>
        <button class="sp-action-btn sp-copy" data-id="${ctx.id}">${t('copy')}</button>
        <button class="sp-action-btn sp-delete" data-id="${ctx.id}">${t('delete')}</button>
      </div>
    </div>`;
  }).join('');

  // View full content
  list.querySelectorAll('.sp-view').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showDetail(btn.dataset.id); });
  });
  // Also click on item to view
  list.querySelectorAll('.sp-item').forEach(item => {
    item.addEventListener('click', () => showDetail(item.dataset.id));
  });
  list.querySelectorAll('.sp-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ctx = contexts.find(c => c.id === btn.dataset.id);
      if (ctx) {
        const content = ctx.mainContent || ctx.selection || ctx.description || '';
        navigator.clipboard.writeText(content);
        btn.textContent = t('copied');
        setTimeout(() => btn.textContent = t('copy'), 1000);
      }
    });
  });
  list.querySelectorAll('.sp-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ action: 'deleteContext', data: { id: btn.dataset.id } });
      contexts = contexts.filter(c => c.id !== btn.dataset.id);
      renderContexts();
    });
  });
}

/**
 * Show full detail view for a captured context
 */
function showDetail(id) {
  const ctx = contexts.find(c => c.id === id);
  if (!ctx) return;

  $('sp-context-list').classList.add('hidden');
  $('sp-search').parentElement.classList.add('hidden');
  const detail = $('sp-detail-view');
  detail.classList.remove('hidden');

  $('sp-detail-title').textContent = ctx.title || t('untitled');
  $('sp-detail-meta').textContent = `${ctx.url || ''} · ${new Date(ctx.timestamp).toLocaleString()}`;

  // AI Summary section
  const summaryEl = $('sp-detail-summary');
  if (ctx.aiSummary) {
    summaryEl.innerHTML = `<div class="sp-summary-label">${t('aiSummaryLabel')}</div><div class="sp-summary-text">${esc(ctx.aiSummary)}</div>`;
    summaryEl.classList.remove('hidden');
    $('sp-detail-summarize').classList.add('hidden');
  } else {
    summaryEl.classList.add('hidden');
    // Show manual summarize button if AI is configured
    const summarizeBtn = $('sp-detail-summarize');
    if (settings.aiEnabled && settings.aiApiKey) {
      summarizeBtn.classList.remove('hidden');
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = t('aiSummarize');
      summarizeBtn.onclick = async () => {
        summarizeBtn.disabled = true;
        summarizeBtn.textContent = t('summarizing');
        try {
          const result = await chrome.runtime.sendMessage({ action: 'summarizeContext', data: { id: ctx.id } });
          if (result && result.success) {
            // Refresh the detail view
            const freshContexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
            contexts = freshContexts;
            showDetail(ctx.id);
          } else {
            summarizeBtn.textContent = result?.error || t('failed');
            setTimeout(() => { summarizeBtn.textContent = t('retry'); summarizeBtn.disabled = false; }, 2000);
          }
        } catch (err) {
          summarizeBtn.textContent = t('errorPrefix', [err.message]);
          setTimeout(() => { summarizeBtn.textContent = t('retry'); summarizeBtn.disabled = false; }, 2000);
        }
      };
    } else {
      summarizeBtn.classList.add('hidden');
    }
  }

  // Full content — render mainContent as preformatted text (it's already Markdown)
  const contentEl = $('sp-detail-content');
  const fullContent = ctx.mainContent || ctx.selection || ctx.description || t('noContentCaptured');
  contentEl.textContent = fullContent;

  // Copy button
  $('sp-detail-copy').onclick = () => {
    navigator.clipboard.writeText(fullContent);
    $('sp-detail-copy').textContent = t('copied');
    setTimeout(() => $('sp-detail-copy').textContent = t('copyFullContent'), 1500);
  };

  // Back button
  $('sp-detail-back').onclick = hideDetail;
}

function hideDetail() {
  $('sp-detail-view').classList.add('hidden');
  $('sp-context-list').classList.remove('hidden');
  $('sp-search').parentElement.classList.remove('hidden');
}

function formatSize(chars) {
  if (chars < 1000) return t('chars', [chars]);
  if (chars < 10000) return (chars / 1000).toFixed(1) + 'K';
  return Math.round(chars / 1000) + 'K';
}

// ==================== Library ====================

function renderLibrary() {
  const container = $('sp-library-list');
  container.innerHTML = PROMPT_CATEGORIES.map(cat => `
    <div class="sp-lib-category">
      <div class="sp-lib-header"><span>${cat.icon}</span> ${esc(cat.name)}</div>
      <div class="sp-lib-prompts">
        ${cat.prompts.map(p => `
          <div class="sp-lib-prompt" data-template="${escAttr(p.template)}" title="${esc(p.title)}">
            ${esc(p.title)}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.sp-lib-prompt').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.dataset.template);
      el.style.background = 'rgba(13,148,136,0.2)';
      setTimeout(() => el.style.background = '', 500);
    });
  });
}

// ==================== History ====================

async function loadHistory() {
  history = await chrome.runtime.sendMessage({ action: 'getPromptHistory' }) || [];
  const list = $('sp-history-list');
  if (history.length === 0) {
    list.innerHTML = `<div class="sp-empty"><img src="../assets/illustrations/empty-history.svg" width="100" alt=""><p>${t('noHistoryYet')}</p></div>`;
    return;
  }
  list.innerHTML = history.map((item, i) => `
    <div class="sp-item" style="animation: cp-stagger-in var(--duration-normal) var(--ease-default) ${i * 30}ms both">
      <div class="sp-item-title">${esc(truncate(item.contextTitle || 'Prompt', 40))}</div>
      <div class="sp-item-meta">${formatTime(item.timestamp)}</div>
      <div class="sp-item-preview">${esc(truncate(item.prompt, 120))}</div>
      <div class="sp-item-actions">
        <button class="sp-action-btn sp-copy" data-content="${escAttr(item.prompt)}">📋 ${t('copy')}</button>
        <button class="sp-action-btn fav ${item.favorite ? 'active' : ''}" data-id="${item.id}">${item.favorite ? '★' : '☆'} ${t('fav')}</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.sp-copy').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); navigator.clipboard.writeText(btn.dataset.content); });
  });
  list.querySelectorAll('.fav').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ action: 'toggleFavorite', data: { id: btn.dataset.id } });
      loadHistory();
    });
  });
}

// ==================== Quality Radar ====================

async function analyzeQuality() {
  const prompt = $('sp-quality-prompt').value.trim();
  if (!prompt) return;
  const btn = $('sp-analyze-btn');
  btn.disabled = true;
  btn.textContent = t('analyzing');

  try {
    const result = await chrome.runtime.sendMessage({ action: 'analyzePromptQuality', data: { prompt } });
    if (result.success && result.analysis) {
      drawRadar(result.analysis);
      renderQualityResult(result.analysis);
    } else {
      $('sp-quality-result').innerHTML = `<p style="color:var(--cp-danger)">${result.error || 'Analysis failed. Configure AI in settings.'}</p>`;
    }
  } catch (err) {
    $('sp-quality-result').innerHTML = `<p style="color:var(--cp-danger)">${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = t('analyzeQuality');
  }
}

function drawRadar(analysis) {
  const canvas = $('sp-radar-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const r = Math.min(cx, cy) - 40;

  ctx.clearRect(0, 0, w, h);

  const labels = [t('clarity'), t('specificity'), t('completeness'), t('overall')];
  const values = [
    (analysis.clarity || 5) / 10,
    (analysis.specificity || 5) / 10,
    (analysis.completeness || 5) / 10,
    (analysis.overall || 5) / 10
  ];
  const n = labels.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  // Grid
  for (let level = 1; level <= 5; level++) {
    const lr = (r * level) / 5;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = startAngle + i * angleStep;
      const x = cx + lr * Math.cos(angle);
      const y = cy + lr * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(13,148,136,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.strokeStyle = 'rgba(13,148,136,0.2)';
    ctx.stroke();
  }

  // Data polygon
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const idx = i % n;
    const angle = startAngle + idx * angleStep;
    const vr = r * values[idx];
    const x = cx + vr * Math.cos(angle);
    const y = cy + vr * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.fillStyle = 'rgba(13,148,136,0.2)';
  ctx.fill();
  ctx.strokeStyle = '#0D9488';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Points & Labels
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const vr = r * values[i];
    // Point
    ctx.beginPath();
    ctx.arc(cx + vr * Math.cos(angle), cy + vr * Math.sin(angle), 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#0D9488';
    ctx.fill();
    // Label
    const lx = cx + (r + 24) * Math.cos(angle);
    const ly = cy + (r + 24) * Math.sin(angle);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('color') || '#134e4a';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${labels[i]} ${Math.round(values[i] * 10)}`, lx, ly);
  }
}

function renderQualityResult(analysis) {
  const container = $('sp-quality-result');
  let html = `
    <div class="sp-score-row"><span class="sp-score-label">${t('clarity')}</span><span class="sp-score-value">${analysis.clarity || '-'}/10</span></div>
    <div class="sp-score-row"><span class="sp-score-label">${t('specificity')}</span><span class="sp-score-value">${analysis.specificity || '-'}/10</span></div>
    <div class="sp-score-row"><span class="sp-score-label">${t('completeness')}</span><span class="sp-score-value">${analysis.completeness || '-'}/10</span></div>
    <div class="sp-score-row"><span class="sp-score-label">${t('overall')}</span><span class="sp-score-value">${analysis.overall || '-'}/10</span></div>
  `;
  if (analysis.suggestions && analysis.suggestions.length) {
    html += `<div class="sp-suggestions"><h4>${t('suggestions')}</h4>${analysis.suggestions.map(s => `<div class="sp-suggestion-item">${esc(s)}</div>`).join('')}</div>`;
  }
  if (analysis.improvedPrompt) {
    html += `<div class="sp-suggestions"><h4>${t('improvedPrompt')}</h4><div class="sp-suggestion-item" style="cursor:pointer" onclick="navigator.clipboard.writeText(this.textContent)">${esc(analysis.improvedPrompt)}</div></div>`;
  }
  container.innerHTML = html;
}

// ==================== Utilities ====================

function esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function escAttr(t) { return (t || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function truncate(t, m) { return !t ? '' : t.length <= m ? t : t.substring(0, m) + '...'; }
function truncateUrl(u) { if (!u) return ''; try { const p = new URL(u); let r = p.hostname + p.pathname; return r.length > 40 ? r.substring(0, 40) + '...' : r; } catch { return truncate(u, 40); } }
function formatTime(ts) {
  if (!ts) return '';
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return t('justNow');
  if (d < 3600000) return t('mAgo', [Math.floor(d / 60000)]);
  if (d < 86400000) return t('hAgo', [Math.floor(d / 3600000)]);
  return new Date(ts).toLocaleDateString();
}

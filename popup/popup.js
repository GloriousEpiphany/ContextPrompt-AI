/**
 * ContextPrompt AI - Popup Script
 * Handles popup UI interactions and context management
 */

document.addEventListener('DOMContentLoaded', init);

// DOM References
let captureBtn, clearAllBtn, settingsBtn, backBtn;
let contextList, templateSelect;
let enableInjectionToggle, themeSelect, languageSelect;
let mainView, settingsView;
// AI Settings DOM
let aiEnabledToggle, aiProviderSelect, aiApiKeyInput, aiBaseUrlInput, aiModelSelect, testAiBtn;

// State
let contexts = [];
let templates = [];
let settings = {};
let selectedContextIds = []; // For multi-select fusion

async function init() {
    // Get DOM references
    captureBtn = document.getElementById('capture-btn');
    clearAllBtn = document.getElementById('clear-all-btn');
    settingsBtn = document.getElementById('settings-btn');
    backBtn = document.getElementById('back-btn');
    contextList = document.getElementById('context-list');
    templateSelect = document.getElementById('template-select');
    enableInjectionToggle = document.getElementById('enable-injection');
    themeSelect = document.getElementById('theme-select');
    languageSelect = document.getElementById('language-select');
    mainView = document.getElementById('main-view');
    settingsView = document.getElementById('settings-view');
    // AI Settings DOM
    aiEnabledToggle = document.getElementById('ai-enabled');
    aiProviderSelect = document.getElementById('ai-provider');
    aiApiKeyInput = document.getElementById('ai-api-key');
    aiBaseUrlInput = document.getElementById('ai-base-url');
    aiModelSelect = document.getElementById('ai-model');
    testAiBtn = document.getElementById('test-ai-btn');
    captureDepthSelect = document.getElementById('capture-depth');

    // Bind events
    captureBtn.addEventListener('click', handleCapture);
    clearAllBtn.addEventListener('click', handleClearAll);
    settingsBtn.addEventListener('click', showSettings);
    backBtn.addEventListener('click', hideSettings);
    templateSelect.addEventListener('change', handleTemplateChange);
    enableInjectionToggle.addEventListener('change', handleSettingChange);
    themeSelect.addEventListener('change', handleSettingChange);
    languageSelect.addEventListener('change', handleSettingChange);
    // AI Settings events
    if (aiEnabledToggle) aiEnabledToggle.addEventListener('change', handleAISettingChange);
    if (aiProviderSelect) aiProviderSelect.addEventListener('change', handleAISettingChange);
    if (aiApiKeyInput) aiApiKeyInput.addEventListener('change', handleAISettingChange);
    if (aiBaseUrlInput) aiBaseUrlInput.addEventListener('change', handleAISettingChange);
    if (aiModelSelect) aiModelSelect.addEventListener('change', handleAISettingChange);
    if (captureDepthSelect) captureDepthSelect.addEventListener('change', handleAISettingChange);
    if (testAiBtn) testAiBtn.addEventListener('click', handleTestAI);

    // Load data
    await loadData();

    // Apply theme
    applyTheme(settings.theme);
}

async function loadData() {
    try {
        // Load contexts
        contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];

        // Load templates
        templates = await chrome.runtime.sendMessage({ action: 'getTemplates' }) || [];

        // Load settings
        settings = await chrome.runtime.sendMessage({ action: 'getSettings' }) || {};

        // Render UI
        renderContextList();
        renderTemplates();
        applySettings();
    } catch (error) {
        console.error('Failed to load data:', error);
        showToast('Failed to load data / 加载数据失败', 'error');
    }
}

function renderContextList() {
    if (contexts.length === 0) {
        contextList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No captured contexts yet.<br>没有已捕获的上下文。</p>
        <p class="hint">Visit any page and click "Capture"<br>访问任意页面并点击"捕获"</p>
      </div>
    `;
        return;
    }

    contextList.innerHTML = contexts.map(ctx => `
    <div class="context-item" data-id="${ctx.id}">
      <div class="context-header">
        <span class="context-title" title="${escapeHtml(ctx.title)}">${escapeHtml(truncate(ctx.title, 40))}</span>
        <button class="delete-btn" data-id="${ctx.id}" title="Delete / 删除">×</button>
      </div>
      <div class="context-url" title="${escapeHtml(ctx.url)}">${escapeHtml(truncateUrl(ctx.url))}</div>
      <div class="context-preview">${escapeHtml(truncate(ctx.selection || ctx.description || 'No content', 80))}</div>
      <div class="context-time">${formatTime(ctx.timestamp)}</div>
    </div>
  `).join('');

    // Bind delete buttons
    contextList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDelete(btn.dataset.id);
        });
    });

    // Bind context item click to select (with multi-select support)
    contextList.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                // Multi-select mode
                toggleMultiSelect(item.dataset.id);
            } else {
                // Single select mode
                clearMultiSelect();
                selectContext(item.dataset.id);
            }
        });
    });

    // Show hint when AI is enabled
    updateMultiSelectHint();
}

function renderTemplates() {
    templateSelect.innerHTML = templates.map(tmpl => `
    <option value="${tmpl.id}" ${tmpl.id === settings.defaultTemplate ? 'selected' : ''}>
      ${escapeHtml(tmpl.name)}
    </option>
  `).join('');
}

function applySettings() {
    enableInjectionToggle.checked = settings.enableInjection !== false;
    themeSelect.value = settings.theme || 'system';
    languageSelect.value = settings.language || 'auto';

    // AI Settings
    if (aiEnabledToggle) aiEnabledToggle.checked = settings.aiEnabled || false;
    if (aiProviderSelect) aiProviderSelect.value = settings.aiProvider || 'openai';
    if (aiApiKeyInput) aiApiKeyInput.value = settings.aiApiKey || '';
    if (aiBaseUrlInput) aiBaseUrlInput.value = settings.aiBaseUrl || '';
    if (aiModelSelect) aiModelSelect.value = settings.aiModel || 'gpt-4o-mini';
    if (captureDepthSelect) captureDepthSelect.value = settings.captureDepth || 'standard';

    // Toggle AI settings visibility
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

async function handleCapture() {
    captureBtn.disabled = true;
    captureBtn.classList.add('loading');

    try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            showToast('No active tab / 无活动标签页', 'error');
            return;
        }

        // Check if it's a valid URL (not chrome://, about:, etc.)
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
            showToast('Cannot capture this page / 无法捕获此页面', 'error');
            return;
        }

        // Prepare capture options with depth setting
        const captureOptions = {
            captureDepth: settings.captureDepth || 'standard'
        };

        let response;
        try {
            // Request context from content script
            response = await chrome.tabs.sendMessage(tab.id, {
                action: 'captureContext',
                options: captureOptions
            });
        } catch (sendError) {
            // Content script not loaded, try to inject it first
            console.log('Content script not available, injecting...');
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content-scripts/capture.js']
                });
                // Wait a moment for script to initialize
                await new Promise(resolve => setTimeout(resolve, 200));
                // Try again
                response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'captureContext',
                    options: captureOptions
                });
            } catch (injectError) {
                console.error('Failed to inject content script:', injectError);
                showToast('Cannot access this page / 无法访问此页面', 'error');
                return;
            }
        }

        if (response && response.success) {
            // Save context
            const result = await chrome.runtime.sendMessage({
                action: 'saveContext',
                data: response.context
            });

            if (result.success) {
                // Reload contexts
                contexts = await chrome.runtime.sendMessage({ action: 'getAllContexts' }) || [];
                renderContextList();
                showToast('Context captured! / 上下文已捕获！', 'success');
            } else {
                showToast('Failed to save / 保存失败', 'error');
            }
        } else {
            showToast('Failed to capture / 捕获失败', 'error');
        }
    } catch (error) {
        console.error('Capture error:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        captureBtn.disabled = false;
        captureBtn.classList.remove('loading');
    }
}

async function handleDelete(id) {
    try {
        const result = await chrome.runtime.sendMessage({
            action: 'deleteContext',
            data: { id }
        });

        if (result.success) {
            contexts = contexts.filter(ctx => ctx.id !== id);
            renderContextList();
            showToast('Deleted / 已删除', 'success');
        }
    } catch (error) {
        showToast('Failed to delete / 删除失败', 'error');
    }
}

async function handleClearAll() {
    if (!confirm('Clear all saved contexts?\n清除所有已保存的上下文？')) {
        return;
    }

    try {
        const result = await chrome.runtime.sendMessage({ action: 'clearAllContexts' });

        if (result.success) {
            contexts = [];
            renderContextList();
            showToast('All cleared / 已全部清除', 'success');
        }
    } catch (error) {
        showToast('Failed to clear / 清除失败', 'error');
    }
}

function selectContext(id) {
    // Mark as selected in UI
    contextList.querySelectorAll('.context-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.id === id);
    });
}

async function handleTemplateChange() {
    settings.defaultTemplate = templateSelect.value;
    await saveSettings();
}

async function handleSettingChange() {
    settings.enableInjection = enableInjectionToggle.checked;
    settings.theme = themeSelect.value;
    settings.language = languageSelect.value;

    applyTheme(settings.theme);
    await saveSettings();
}

async function saveSettings() {
    try {
        await chrome.runtime.sendMessage({
            action: 'saveSettings',
            data: settings
        });
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

// ==================== AI Settings Functions ====================

function updateAISettingsVisibility() {
    const aiSettings = document.querySelectorAll('.ai-settings');
    const customOnly = document.querySelectorAll('.ai-custom-only');
    const isEnabled = settings.aiEnabled || false;
    const isCustom = settings.aiProvider === 'custom';

    aiSettings.forEach(el => {
        el.style.opacity = isEnabled ? '1' : '0.5';
        el.style.pointerEvents = isEnabled ? 'auto' : 'none';
    });

    customOnly.forEach(el => {
        if (isEnabled && isCustom) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // Update datalist based on provider (optional suggestions)
    updateModelSuggestions();
}

function updateModelSuggestions() {
    const datalist = document.getElementById('ai-model-list');
    if (!datalist) return;

    const provider = settings.aiProvider || 'openai';
    const models = {
        openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4-turbo'],
        deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
        qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'],
        custom: []
    };

    const providerModels = models[provider] || [];
    datalist.innerHTML = providerModels.map(m => `<option value="${m}">`).join('');
}

async function handleAISettingChange() {
    settings.aiEnabled = aiEnabledToggle?.checked || false;
    settings.aiProvider = aiProviderSelect?.value || 'openai';
    settings.aiApiKey = aiApiKeyInput?.value || '';
    settings.aiBaseUrl = aiBaseUrlInput?.value || '';
    settings.aiModel = aiModelSelect?.value || 'gpt-4o-mini';
    settings.captureDepth = captureDepthSelect?.value || 'standard';

    updateAISettingsVisibility();
    await saveSettings();
}

async function handleTestAI() {
    if (!testAiBtn) return;

    testAiBtn.disabled = true;
    testAiBtn.textContent = '⏳ Testing...';

    try {
        const result = await chrome.runtime.sendMessage({ action: 'testAIConnection' });

        if (result.success) {
            showToast('✅ Connection successful! / 连接成功！', 'success');
        } else {
            showToast('❌ ' + (result.error || 'Connection failed'), 'error');
        }
    } catch (error) {
        showToast('❌ ' + error.message, 'error');
    } finally {
        testAiBtn.disabled = false;
        testAiBtn.textContent = '🔗 Test Connection / 测试连接';
    }
}

// ==================== Multi-Select & Fusion Functions ====================

function toggleMultiSelect(contextId) {
    const index = selectedContextIds.indexOf(contextId);
    if (index > -1) {
        selectedContextIds.splice(index, 1);
    } else {
        selectedContextIds.push(contextId);
    }
    updateMultiSelectUI();
}

function clearMultiSelect() {
    selectedContextIds = [];
    updateMultiSelectUI();
}

function updateMultiSelectUI() {
    // Update visual selection
    contextList.querySelectorAll('.context-item').forEach(item => {
        const isMultiSelected = selectedContextIds.includes(item.dataset.id);
        item.classList.toggle('multi-selected', isMultiSelected);
    });

    // Show/hide fuse button
    const fuseBtn = document.getElementById('fuse-btn');
    if (fuseBtn) {
        if (selectedContextIds.length >= 2 && settings.aiEnabled) {
            fuseBtn.classList.remove('hidden');
        } else {
            fuseBtn.classList.add('hidden');
        }
    }
}

function updateMultiSelectHint() {
    const hint = document.getElementById('multi-select-hint');
    if (hint) {
        if (settings.aiEnabled && contexts.length >= 2) {
            hint.classList.remove('hidden');
        } else {
            hint.classList.add('hidden');
        }
    }
}

async function handleFuseContexts() {
    if (selectedContextIds.length < 2) {
        showToast('⚠️ Select at least 2 contexts / 请选择至少2个上下文', 'warning');
        return;
    }

    const fuseBtn = document.getElementById('fuse-btn');
    if (fuseBtn) {
        fuseBtn.disabled = true;
        fuseBtn.textContent = '⏳ Fusing...';
    }

    try {
        const selectedContexts = contexts.filter(ctx => selectedContextIds.includes(ctx.id));

        const result = await chrome.runtime.sendMessage({
            action: 'fuseContexts',
            data: { contexts: selectedContexts }
        });

        if (result.success) {
            // Create a new fused context
            const fusedContext = {
                title: `🧠 Fused: ${selectedContexts.map(c => c.title).slice(0, 2).join(' + ')}...`,
                url: 'fused://multiple-sources',
                selection: result.fusedContent,
                description: result.fusedContent,
                ogData: {}
            };

            await chrome.runtime.sendMessage({ action: 'saveContext', data: fusedContext });
            showToast('✅ Contexts fused successfully! / 上下文融合成功！', 'success');

            clearMultiSelect();
            await loadData();
        } else {
            showToast('❌ ' + (result.error || 'Fusion failed'), 'error');
        }
    } catch (error) {
        showToast('❌ ' + error.message, 'error');
    } finally {
        if (fuseBtn) {
            fuseBtn.disabled = false;
            fuseBtn.textContent = '🧠 Fuse';
        }
    }
}

// Initialize fuse button event
document.addEventListener('DOMContentLoaded', () => {
    const fuseBtn = document.getElementById('fuse-btn');
    if (fuseBtn) {
        fuseBtn.addEventListener('click', handleFuseContexts);
    }
});


function showSettings() {
    mainView.classList.add('hidden');
    settingsView.classList.remove('hidden');
}

function hideSettings() {
    settingsView.classList.add('hidden');
    mainView.classList.remove('hidden');
}

// ==================== Utility Functions ====================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function truncateUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        let result = parsed.hostname + parsed.pathname;
        if (result.length > 45) {
            result = result.substring(0, 45) + '...';
        }
        return result;
    } catch {
        return truncate(url, 45);
    }
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now / 刚刚';
    }

    // Less than 1 hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min ago / ${mins}分钟前`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hr ago / ${hours}小时前`;
    }

    // Format as date
    return date.toLocaleDateString();
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 2 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

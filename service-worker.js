/**
 * ContextPrompt AI - Service Worker v3.0
 * Integrates AIService & PromptEngine, uses local storage, adds context menus,
 * keyboard shortcuts, badge, prompt history, tags, auto-capture, favorites.
 */

import { AIService } from './lib/ai-service.js';
import { PromptEngine } from './lib/nlp-engine.js';

const MAX_CONTEXTS = 50;
const MAX_HISTORY = 100;
const promptEngine = new PromptEngine();
let aiService = new AIService();

// ==================== Initialization ====================

chrome.runtime.onInstalled.addListener(async (details) => {
  // Migrate session storage to local on update
  if (details.reason === 'update') {
    try {
      const sessionData = await getStorageData('contexts', 'session');
      if (sessionData && sessionData.length > 0) {
        const existing = await getStorageData('contexts', 'local') || [];
        const merged = [...sessionData, ...existing].slice(0, MAX_CONTEXTS);
        await setStorageData('contexts', merged, 'local');
        chrome.storage.session.remove('contexts');
      }
    } catch (e) { /* ignore migration errors */ }
  }

  // Show onboarding for new installs
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }

  // Setup context menus
  setupContextMenus();

  // Initialize badge
  await updateBadge();
});

// ==================== Context Menus ====================

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'capture-page',
      title: chrome.i18n.getMessage('capturePageMenu') || 'Capture this page',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'capture-selection',
      title: chrome.i18n.getMessage('captureSelectionMenu') || 'Capture selected text',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'capture-link',
      title: chrome.i18n.getMessage('captureLinkMenu') || 'Capture link',
      contexts: ['link']
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'capture-page') {
      await captureFromTab(tab);
    } else if (info.menuItemId === 'capture-selection') {
      await saveContext({
        title: tab.title || 'Selection',
        url: tab.url || '',
        selection: info.selectionText || '',
        description: info.selectionText || ''
      });
    } else if (info.menuItemId === 'capture-link') {
      await saveContext({
        title: info.linkUrl || 'Link',
        url: info.linkUrl || '',
        description: `Link from: ${tab.title}`
      });
    }
  } catch (e) { /* ignore */ }
});

// ==================== Keyboard Shortcuts ====================

chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    if (command === 'capture-page') {
      await captureFromTab(tab);
    } else if (command === 'generate-prompt') {
      await chrome.tabs.sendMessage(tab.id, { action: 'triggerCraftPrompt' });
    }
  } catch (e) { /* ignore */ }
});

async function captureFromTab(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;
  try {
    const settings = await getSettings();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-scripts/capture.js']
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 200));
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'captureContext',
      options: { captureDepth: settings.captureDepth || 'standard' }
    });
    if (response && response.success) {
      await saveContext(response.context);
    }
  } catch (e) { /* ignore */ }
}

// ==================== Auto Capture ====================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  try {
    const settings = await getSettings();
    if (!settings.autoCapture || !settings.autoCapturePatterns) return;
    const patterns = settings.autoCapturePatterns.split('\n').map(p => p.trim()).filter(Boolean);
    const matches = patterns.some(pattern => {
      try {
        return new RegExp(pattern.replace(/\*/g, '.*')).test(tab.url);
      } catch { return false; }
    });
    if (matches) {
      await captureFromTab(tab);
    }
  } catch (e) { /* ignore */ }
});

// ==================== Message Handler ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    sendResponse({ success: false, error: err.message });
  });
  return true;
});

async function handleMessage(message, sender) {
  const { action, data } = message;

  try {
    switch (action) {
      // Context CRUD
      case 'saveContext': return await saveContext(data);
      case 'getLatestContext': return await getLatestContext();
      case 'getAllContexts': return await getAllContexts();
      case 'deleteContext': return await deleteContext(data.id);
      case 'clearAllContexts': return await clearAllContexts();
      case 'updateContext': return await updateContext(data);

      // Settings
      case 'getSettings': return await getSettings();
      case 'saveSettings': return await saveSettings(data);

      // Templates
      case 'getTemplates': return await getTemplates();
      case 'saveTemplate': return await saveTemplate(data);
      case 'deleteTemplate': return await deleteTemplate(data.id);

      // AI
      case 'summarizeWithAI': return await summarizeWithAI(data);
      case 'summarizeContext': return await manualSummarizeContext(data.id);
      case 'analyzePromptQuality': return await analyzePromptQuality(data);
      case 'fuseContexts': return await fuseContextsWithAI(data);
      case 'testAIConnection': return await testAIConnection();

      // NLP (local)
      case 'localSummarize': return { success: true, summary: promptEngine.createSummary(data) };

      // Prompt History
      case 'savePromptHistory': return await savePromptHistory(data);
      case 'getPromptHistory': return await getPromptHistory();
      case 'clearPromptHistory': return await clearPromptHistory();

      // Favorites
      case 'toggleFavorite': return await toggleFavorite(data.id);
      case 'getFavorites': return await getFavorites();

      // Export/Import
      case 'exportData': return await exportData();
      case 'importData': return await importData(data);

      // Tags
      case 'suggestTags': return await suggestTags(data);

      default: return { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Context Management ====================

async function saveContext(contextData) {
  try {
    const contexts = await getStorageData('contexts', 'local') || [];
    const newContext = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      title: contextData.title || 'Untitled',
      url: contextData.url || '',
      selection: contextData.selection || '',
      description: contextData.description || '',
      ogData: contextData.ogData || {},
      structuredData: contextData.structuredData || {},
      mainContent: contextData.mainContent || '',
      chatContent: contextData.chatContent || '',
      isPrivateLink: contextData.isPrivateLink || false,
      platformName: contextData.platformName || '',
      captureDepth: contextData.captureDepth || 'standard',
      notes: contextData.notes || '',
      tags: contextData.tags || [],
      aiSummary: ''
    };
    contexts.unshift(newContext);
    if (contexts.length > MAX_CONTEXTS) contexts.pop();
    await setStorageData('contexts', contexts, 'local');
    await updateBadge();

    // Auto AI summarization (non-blocking)
    autoSummarizeContext(newContext.id).catch(err => {
      console.error('[ContextPrompt] Auto-summarize error:', err);
    });

    return { success: true, context: newContext };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Auto-summarize captured content with AI (runs in background)
 */
async function autoSummarizeContext(contextId) {
  const settings = await getSettings();
  if (!settings.autoSummarize || !settings.aiEnabled || !settings.aiApiKey) {
    console.log('[ContextPrompt] Auto-summarize skipped:', !settings.autoSummarize ? 'disabled' : !settings.aiEnabled ? 'AI not enabled' : 'no API key');
    return;
  }

  const contexts = await getStorageData('contexts', 'local') || [];
  const ctx = contexts.find(c => c.id === contextId);
  if (!ctx) return;

  // Determine content to summarize (priority: mainContent > chatContent > selection)
  const content = ctx.mainContent || ctx.chatContent || ctx.selection || '';
  if (content.length < 100) {
    console.log('[ContextPrompt] Auto-summarize skipped: content too short (' + content.length + ' chars)');
    return;
  }

  try {
    const service = await refreshAIService();
    if (!service.isConfigured()) {
      console.warn('[ContextPrompt] Auto-summarize skipped: AI service not configured');
      return;
    }

    console.log('[ContextPrompt] Starting AI summarization for context:', contextId, '(' + content.length + ' chars)');
    const language = settings.language === 'auto' ? detectContentLanguage(content) : settings.language;
    const summary = await service.summarize(content, { language, maxLength: 500 });

    if (summary) {
      // Update the context with AI summary
      const freshContexts = await getStorageData('contexts', 'local') || [];
      const idx = freshContexts.findIndex(c => c.id === contextId);
      if (idx !== -1) {
        freshContexts[idx].aiSummary = summary;
        await setStorageData('contexts', freshContexts, 'local');
        console.log('[ContextPrompt] AI summary saved for context:', contextId);
      }
    }
  } catch (err) {
    console.error('[ContextPrompt] Auto-summarize failed:', err.message || err);
  }
}

/**
 * Manual AI summarization triggered by user
 */
async function manualSummarizeContext(contextId) {
  try {
    const service = await refreshAIService();
    console.log('[ContextPrompt] Manual summarize - provider:', service.provider, 'model:', service.model, 'configured:', service.isConfigured());
    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured. Enable AI and set API key in settings.' };
    }

    const contexts = await getStorageData('contexts', 'local') || [];
    const ctx = contexts.find(c => c.id === contextId);
    if (!ctx) return { success: false, error: 'Context not found' };

    const content = ctx.mainContent || ctx.chatContent || ctx.selection || '';
    console.log('[ContextPrompt] Content to summarize:', content.length, 'chars');
    if (content.length < 50) return { success: false, error: 'Content too short to summarize (' + content.length + ' chars)' };

    const settings = await getSettings();
    const language = settings.language === 'auto' ? detectContentLanguage(content) : settings.language;
    console.log('[ContextPrompt] Calling AI summarize, language:', language, 'endpoint:', service.getBaseUrl());
    const summary = await service.summarize(content, { language, maxLength: 500 });

    if (summary) {
      const freshContexts = await getStorageData('contexts', 'local') || [];
      const idx = freshContexts.findIndex(c => c.id === contextId);
      if (idx !== -1) {
        freshContexts[idx].aiSummary = summary;
        await setStorageData('contexts', freshContexts, 'local');
      }
      console.log('[ContextPrompt] Manual summarize success, summary length:', summary.length);
      return { success: true, summary };
    }
    return { success: false, error: 'AI returned empty response' };
  } catch (error) {
    console.error('[ContextPrompt] Manual summarize failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Simple language detection for auto-summarization
 */
function detectContentLanguage(text) {
  const sample = text.substring(0, 500);
  const chineseChars = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseChars / sample.length > 0.1 ? 'zh' : 'en';
}

async function getLatestContext() {
  try {
    const contexts = await getStorageData('contexts', 'local') || [];
    return contexts.length > 0 ? contexts[0] : null;
  } catch { return null; }
}

async function getAllContexts() {
  try {
    return await getStorageData('contexts', 'local') || [];
  } catch { return []; }
}

async function deleteContext(id) {
  try {
    let contexts = await getStorageData('contexts', 'local') || [];
    contexts = contexts.filter(ctx => ctx.id !== id);
    await setStorageData('contexts', contexts, 'local');
    await updateBadge();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clearAllContexts() {
  try {
    await setStorageData('contexts', [], 'local');
    await updateBadge();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateContext(data) {
  try {
    const contexts = await getStorageData('contexts', 'local') || [];
    const idx = contexts.findIndex(c => c.id === data.id);
    if (idx === -1) return { success: false, error: 'Context not found' };
    contexts[idx] = { ...contexts[idx], ...data };
    await setStorageData('contexts', contexts, 'local');
    return { success: true, context: contexts[idx] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Settings ====================

const DEFAULT_SETTINGS = {
  enableInjection: true,
  language: 'auto',
  theme: 'system',
  defaultTemplate: 'standard',
  aiEnabled: false,
  aiProvider: 'openai',
  aiApiKey: '',
  aiBaseUrl: '',
  aiModel: 'gpt-4o-mini',
  autoSummarize: true,
  captureDepth: 'standard',
  autoCapture: false,
  autoCapturePatterns: ''
};

async function getSettings() {
  try {
    const settings = await getStorageData('settings', 'local');
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch { return DEFAULT_SETTINGS; }
}

async function saveSettings(newSettings) {
  try {
    const current = await getSettings();
    const merged = { ...current, ...newSettings };
    await setStorageData('settings', merged, 'local');
    // Update AI service instance
    aiService.updateSettings(merged);
    return { success: true, settings: merged };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Templates ====================

const DEFAULT_TEMPLATES = [
  {
    id: 'standard', name: 'Standard',
    template: `📌 Context from: {title}\n🔗 {url}\n\n{summary}\n\n❓ My question: {query}`
  },
  {
    id: 'detailed', name: 'Detailed',
    template: `📌 Source: {title}\n🔗 URL: {url}\n\n📄 Content:\n{content}\n\n❓ Question: {query}`
  },
  {
    id: 'chinese', name: '中文模板',
    template: `📌 来源：{title}\n🔗 链接：{url}\n\n🤖 内容摘要：\n{summary}\n\n❓ 我的问题：{query}`
  },
  {
    id: 'ai_chat', name: 'AI Chat Context',
    template: `📌 来自 AI 对话: {title}\n\n💬 对话内容摘要:\n{chatSummary}\n\n⚠️ 注意：原始对话链接为私有链接，无法直接访问。\n\n❓ 我的问题: {query}`
  }
];

async function getTemplates() {
  try {
    const custom = await getStorageData('customTemplates', 'local') || [];
    return [...DEFAULT_TEMPLATES, ...custom];
  } catch { return DEFAULT_TEMPLATES; }
}

async function saveTemplate(template) {
  try {
    const custom = await getStorageData('customTemplates', 'local') || [];
    if (template.id) {
      const idx = custom.findIndex(t => t.id === template.id);
      if (idx >= 0) custom[idx] = template;
      else custom.push(template);
    } else {
      template.id = 'custom_' + Date.now();
      custom.push(template);
    }
    await setStorageData('customTemplates', custom, 'local');
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteTemplate(id) {
  try {
    let custom = await getStorageData('customTemplates', 'local') || [];
    custom = custom.filter(t => t.id !== id);
    await setStorageData('customTemplates', custom, 'local');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== AI Functions ====================

async function refreshAIService() {
  const settings = await getSettings();
  aiService.updateSettings(settings);
  return aiService;
}

async function summarizeWithAI(data) {
  try {
    const service = await refreshAIService();
    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured', fallback: true };
    }
    const content = data.content || '';
    const language = data.language || 'auto';
    const maxLength = data.maxLength || 300;
    const summary = await service.summarize(content, { language, maxLength });
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: error.message, fallback: true };
  }
}

async function analyzePromptQuality(data) {
  try {
    const service = await refreshAIService();
    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured' };
    }
    const analysis = await service.analyzePromptQuality(data.prompt || '');
    return { success: true, analysis };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fuseContextsWithAI(data) {
  try {
    const service = await refreshAIService();
    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured' };
    }
    const fusedContent = await service.fuseContexts(data.contexts || []);
    return { success: true, fusedContent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testAIConnection() {
  try {
    const service = await refreshAIService();
    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured' };
    }
    return await service.testConnection();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Prompt History ====================

async function savePromptHistory(data) {
  try {
    const history = await getStorageData('promptHistory', 'local') || [];
    history.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      prompt: data.prompt || '',
      template: data.template || '',
      contextTitle: data.contextTitle || '',
      favorite: false
    });
    if (history.length > MAX_HISTORY) history.pop();
    await setStorageData('promptHistory', history, 'local');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getPromptHistory() {
  try {
    return await getStorageData('promptHistory', 'local') || [];
  } catch { return []; }
}

async function clearPromptHistory() {
  try {
    await setStorageData('promptHistory', [], 'local');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Favorites ====================

async function toggleFavorite(id) {
  try {
    const history = await getStorageData('promptHistory', 'local') || [];
    const idx = history.findIndex(h => h.id === id);
    if (idx === -1) return { success: false, error: 'Not found' };
    history[idx].favorite = !history[idx].favorite;
    await setStorageData('promptHistory', history, 'local');
    return { success: true, favorite: history[idx].favorite };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getFavorites() {
  try {
    const history = await getStorageData('promptHistory', 'local') || [];
    return history.filter(h => h.favorite);
  } catch { return []; }
}

// ==================== Export / Import ====================

async function exportData() {
  try {
    const contexts = await getStorageData('contexts', 'local') || [];
    const settings = await getSettings();
    const templates = await getStorageData('customTemplates', 'local') || [];
    const history = await getStorageData('promptHistory', 'local') || [];
    return {
      success: true,
      data: {
        version: '3.0.0',
        exportedAt: new Date().toISOString(),
        contexts, settings, customTemplates: templates, promptHistory: history
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function importData(data) {
  try {
    if (!data || !data.version) return { success: false, error: 'Invalid data' };
    let imported = 0;
    if (data.contexts && Array.isArray(data.contexts)) {
      const existing = await getStorageData('contexts', 'local') || [];
      const existingIds = new Set(existing.map(c => c.id));
      const newContexts = data.contexts.filter(c => !existingIds.has(c.id));
      const merged = [...newContexts, ...existing].slice(0, MAX_CONTEXTS);
      await setStorageData('contexts', merged, 'local');
      imported = newContexts.length;
    }
    if (data.customTemplates && Array.isArray(data.customTemplates)) {
      const existing = await getStorageData('customTemplates', 'local') || [];
      const existingIds = new Set(existing.map(t => t.id));
      const newTemplates = data.customTemplates.filter(t => !existingIds.has(t.id));
      await setStorageData('customTemplates', [...existing, ...newTemplates], 'local');
    }
    if (data.promptHistory && Array.isArray(data.promptHistory)) {
      const existing = await getStorageData('promptHistory', 'local') || [];
      const existingIds = new Set(existing.map(h => h.id));
      const newHistory = data.promptHistory.filter(h => !existingIds.has(h.id));
      const merged = [...newHistory, ...existing].slice(0, MAX_HISTORY);
      await setStorageData('promptHistory', merged, 'local');
    }
    await updateBadge();
    return { success: true, imported };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Tags ====================

async function suggestTags(data) {
  try {
    const content = data.content || data.title || '';
    const keywords = promptEngine.extractKeywords(content, 5);
    return { success: true, tags: keywords };
  } catch { return { success: true, tags: [] }; }
}

// ==================== Badge ====================

async function updateBadge() {
  try {
    const contexts = await getStorageData('contexts', 'local') || [];
    const count = contexts.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#0D9488' });
  } catch { /* ignore */ }
}

// ==================== Storage Helpers ====================

function getStorageData(key, storageType = 'local') {
  return new Promise((resolve, reject) => {
    const storage = storageType === 'session' ? chrome.storage.session : chrome.storage.local;
    storage.get([key], (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result[key]);
    });
  });
}

function setStorageData(key, value, storageType = 'local') {
  return new Promise((resolve, reject) => {
    const storage = storageType === 'session' ? chrome.storage.session : chrome.storage.local;
    storage.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

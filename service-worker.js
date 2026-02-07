/**
 * ContextPrompt AI - Service Worker
 * Message hub for cross-tab communication and context storage
 */

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender) {
  const { action, data } = message;
  
  switch (action) {
    case 'saveContext':
      return await saveContext(data);
    
    case 'getLatestContext':
      return await getLatestContext();
    
    case 'getAllContexts':
      return await getAllContexts();
    
    case 'deleteContext':
      return await deleteContext(data.id);
    
    case 'clearAllContexts':
      return await clearAllContexts();
    
    case 'getSettings':
      return await getSettings();
    
    case 'saveSettings':
      return await saveSettings(data);
    
    case 'getTemplates':
      return await getTemplates();
    
    case 'saveTemplate':
      return await saveTemplate(data);
    
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ==================== Context Management ====================

async function saveContext(contextData) {
  try {
    const contexts = await getStorageData('contexts', 'session') || [];
    
    const newContext = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      title: contextData.title || 'Untitled',
      url: contextData.url || '',
      selection: contextData.selection || '',
      description: contextData.description || '',
      ogData: contextData.ogData || {}
    };
    
    // Keep max 20 contexts to prevent storage bloat
    contexts.unshift(newContext);
    if (contexts.length > 20) {
      contexts.pop();
    }
    
    await setStorageData('contexts', contexts, 'session');
    return { success: true, context: newContext };
  } catch (error) {
    console.error('Failed to save context:', error);
    return { success: false, error: error.message };
  }
}

async function getLatestContext() {
  try {
    const contexts = await getStorageData('contexts', 'session') || [];
    return contexts.length > 0 ? contexts[0] : null;
  } catch (error) {
    console.error('Failed to get latest context:', error);
    return null;
  }
}

async function getAllContexts() {
  try {
    return await getStorageData('contexts', 'session') || [];
  } catch (error) {
    console.error('Failed to get all contexts:', error);
    return [];
  }
}

async function deleteContext(id) {
  try {
    let contexts = await getStorageData('contexts', 'session') || [];
    contexts = contexts.filter(ctx => ctx.id !== id);
    await setStorageData('contexts', contexts, 'session');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clearAllContexts() {
  try {
    await setStorageData('contexts', [], 'session');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Settings Management ====================

const DEFAULT_SETTINGS = {
  enableInjection: true,
  language: 'auto', // 'auto', 'en', 'zh'
  theme: 'system',  // 'system', 'light', 'dark'
  defaultTemplate: 'standard'
};

async function getSettings() {
  try {
    const settings = await getStorageData('settings', 'local');
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(newSettings) {
  try {
    const currentSettings = await getSettings();
    const mergedSettings = { ...currentSettings, ...newSettings };
    await setStorageData('settings', mergedSettings, 'local');
    return { success: true, settings: mergedSettings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Template Management ====================

const DEFAULT_TEMPLATES = [
  {
    id: 'standard',
    name: 'Standard / 标准',
    template: `📌 Context from: {title}

{summary}

❓ My question: {query}`
  },
  {
    id: 'detailed',
    name: 'Detailed / 详细',
    template: `📌 Source: {title}
🔗 URL: {url}

📄 Key Information:
{summary}

💬 Selected Text:
{selection}

❓ Question: {query}`
  },
  {
    id: 'concise',
    name: 'Concise / 简洁',
    template: `Based on "{title}": {summary}

Q: {query}`
  },
  {
    id: 'chinese',
    name: '中文模板',
    template: `📌 来源：{title}

📄 关键信息：
{summary}

❓ 我的问题：{query}`
  }
];

async function getTemplates() {
  try {
    const customTemplates = await getStorageData('customTemplates', 'local') || [];
    return [...DEFAULT_TEMPLATES, ...customTemplates];
  } catch (error) {
    return DEFAULT_TEMPLATES;
  }
}

async function saveTemplate(template) {
  try {
    const customTemplates = await getStorageData('customTemplates', 'local') || [];
    
    if (template.id) {
      // Update existing
      const index = customTemplates.findIndex(t => t.id === template.id);
      if (index >= 0) {
        customTemplates[index] = template;
      } else {
        customTemplates.push(template);
      }
    } else {
      // Create new
      template.id = 'custom_' + Date.now();
      customTemplates.push(template);
    }
    
    await setStorageData('customTemplates', customTemplates, 'local');
    return { success: true, template };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== Storage Helpers ====================

function getStorageData(key, storageType = 'local') {
  return new Promise((resolve, reject) => {
    const storage = storageType === 'session' ? chrome.storage.session : chrome.storage.local;
    storage.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

function setStorageData(key, value, storageType = 'local') {
  return new Promise((resolve, reject) => {
    const storage = storageType === 'session' ? chrome.storage.session : chrome.storage.local;
    storage.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Log startup
console.log('✨ ContextPrompt AI Service Worker started');

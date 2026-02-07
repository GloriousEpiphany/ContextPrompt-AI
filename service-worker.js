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

    // AI API Actions
    case 'summarizeWithAI':
      return await summarizeWithAI(data);

    case 'analyzePromptQuality':
      return await analyzePromptQuality(data);

    case 'fuseContexts':
      return await fuseContextsWithAI(data);

    case 'testAIConnection':
      return await testAIConnection();

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
      ogData: contextData.ogData || {},
      mainContent: contextData.mainContent || '',
      // New fields for AI chat support
      chatContent: contextData.chatContent || '',
      isPrivateLink: contextData.isPrivateLink || false,
      platformName: contextData.platformName || '',
      captureDepth: contextData.captureDepth || 'standard'
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
  defaultTemplate: 'standard',
  // AI API Settings
  aiEnabled: false,
  aiProvider: 'openai',
  aiApiKey: '',
  aiBaseUrl: '',
  aiModel: 'gpt-4o-mini',
  autoSummarize: true,
  // Capture depth: 'light', 'standard', 'deep'
  captureDepth: 'standard'
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
  },
  {
    id: 'ai_chat',
    name: 'AI Chat Context / AI对话上下文',
    template: `📌 来自 AI 对话: {title}

💬 对话内容摘要:
{chatSummary}

⚠️ 注意：原始对话链接为私有链接，无法直接访问。以上是对话的关键内容。

❓ 我的问题: {query}`
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

// ==================== AI API Functions ====================

// Import AI service dynamically (for service worker compatibility)
let aiServiceInstance = null;

async function getAIService() {
  if (!aiServiceInstance) {
    // Create a simple AI service implementation for service worker
    const settings = await getSettings();
    aiServiceInstance = createAIService(settings);
  }
  return aiServiceInstance;
}

function createAIService(settings) {
  return {
    enabled: settings.aiEnabled || false,
    provider: settings.aiProvider || 'openai',
    apiKey: settings.aiApiKey || '',
    baseUrl: settings.aiBaseUrl || '',
    model: settings.aiModel || 'gpt-4o-mini',

    isConfigured() {
      return this.enabled && this.apiKey && this.apiKey.length > 0;
    },

    getBaseUrl() {
      const providers = {
        openai: 'https://api.openai.com/v1',
        deepseek: 'https://api.deepseek.com/v1',
        anthropic: 'https://api.anthropic.com/v1',
        qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      };
      if (this.provider === 'custom' && this.baseUrl) {
        return this.baseUrl;
      }
      return providers[this.provider] || providers.openai;
    },

    async callAPI(messages, options = {}) {
      if (!this.isConfigured()) {
        throw new Error('AI service not configured');
      }

      const endpoint = `${this.getBaseUrl()}/chat/completions`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }
  };
}

async function summarizeWithAI(data) {
  console.log('[SW] summarizeWithAI called');
  try {
    const settings = await getSettings();
    console.log('[SW] Settings:', { aiEnabled: settings.aiEnabled, aiProvider: settings.aiProvider, hasApiKey: !!settings.aiApiKey });

    const service = createAIService(settings);

    if (!service.isConfigured()) {
      console.log('[SW] AI service not configured');
      return { success: false, error: 'AI not configured', fallback: true };
    }

    const content = data.content || '';
    const language = data.language || settings.language || 'auto';
    const maxLength = data.maxLength || 300;

    console.log('[SW] Calling AI API with content length:', content.length);

    const systemPrompt = language === 'zh'
      ? `你是一个专业的内容摘要助手。请用简洁的中文总结以下内容，突出关键信息，控制在${maxLength}字以内。`
      : `You are a professional content summarizer. Summarize the following content concisely, highlighting key information, within ${maxLength} words.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please summarize:\n\n${content}` }
    ];

    const summary = await service.callAPI(messages, { temperature: 0.5, maxTokens: 500 });
    console.log('[SW] AI API success, summary length:', summary.length);
    return { success: true, summary };
  } catch (error) {
    console.error('[SW] AI summarize error:', error);
    return { success: false, error: error.message, fallback: true };
  }
}

async function analyzePromptQuality(data) {
  try {
    const settings = await getSettings();
    const service = createAIService(settings);

    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured' };
    }

    const prompt = data.prompt || '';

    const systemPrompt = `你是一个提示词质量分析专家。分析以下提示词并返回JSON格式结果：
{
  "clarity": 1-10,
  "specificity": 1-10,
  "completeness": 1-10,
  "overall": 1-10,
  "suggestions": ["建议1", "建议2"],
  "improvedPrompt": "优化后的提示词"
}
只返回JSON。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const response = await service.callAPI(messages, { temperature: 0.3, maxTokens: 800 });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, analysis: JSON.parse(jsonMatch[0]) };
      }
    } catch (e) {
      console.error('Failed to parse analysis:', e);
    }

    return { success: true, analysis: { overall: 5, suggestions: ['分析失败'] } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fuseContextsWithAI(data) {
  try {
    const settings = await getSettings();
    const service = createAIService(settings);

    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured' };
    }

    const contexts = data.contexts || [];
    if (contexts.length === 0) {
      return { success: false, error: 'No contexts to fuse' };
    }

    const contextTexts = contexts.map((ctx, i) => {
      const content = ctx.selection || ctx.description || ctx.chatContent || '';
      return `【Context ${i + 1}: ${ctx.title}】\n${content}`;
    }).join('\n\n---\n\n');

    const systemPrompt = `你是一个智能上下文融合助手。请分析以下多个来源的上下文，找出关联，生成连贯的融合摘要。控制在500字以内。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextTexts }
    ];

    const fusedContent = await service.callAPI(messages, { temperature: 0.5 });
    return { success: true, fusedContent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testAIConnection() {
  try {
    const settings = await getSettings();
    const service = createAIService(settings);

    if (!service.isConfigured()) {
      return { success: false, error: 'AI not configured' };
    }

    const messages = [{ role: 'user', content: 'Hi, respond with OK.' }];
    const response = await service.callAPI(messages, { maxTokens: 10 });
    return { success: true, message: response };
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

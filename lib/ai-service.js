/**
 * ContextPrompt AI - AI Service Module
 * Provides AI-powered summarization and analysis via multiple API providers
 */

// Supported API providers configuration
const API_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o-mini'
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat', 'deepseek-coder'],
        defaultModel: 'deepseek-chat'
    },
    anthropic: {
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229'],
        defaultModel: 'claude-3-haiku-20240307'
    },
    qwen: {
        name: '通义千问',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
        defaultModel: 'qwen-turbo'
    },
    custom: {
        name: 'Custom / 自定义',
        baseUrl: '',
        models: [],
        defaultModel: ''
    }
};

/**
 * AI Service class for API interactions
 */
export class AIService {
    constructor(settings = {}) {
        this.enabled = settings.aiEnabled || false;
        this.provider = settings.aiProvider || 'openai';
        this.apiKey = settings.aiApiKey || '';
        this.baseUrl = settings.aiBaseUrl || '';
        this.model = settings.aiModel || 'gpt-4o-mini';
    }

    /**
     * Update settings
     */
    updateSettings(settings) {
        this.enabled = settings.aiEnabled || false;
        this.provider = settings.aiProvider || 'openai';
        this.apiKey = settings.aiApiKey || '';
        this.baseUrl = settings.aiBaseUrl || '';
        this.model = settings.aiModel || 'gpt-4o-mini';
    }

    /**
     * Check if AI service is properly configured
     */
    isConfigured() {
        return this.enabled && this.apiKey && this.apiKey.length > 0;
    }

    /**
     * Get the API base URL
     */
    getBaseUrl() {
        if (this.provider === 'custom' && this.baseUrl) {
            return this.baseUrl;
        }
        return API_PROVIDERS[this.provider]?.baseUrl || API_PROVIDERS.openai.baseUrl;
    }

    /**
     * Make API request to the configured provider
     */
    async callAPI(messages, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('AI service not configured. Please set API key in settings.');
        }

        const baseUrl = this.getBaseUrl();
        const endpoint = `${baseUrl}/chat/completions`;

        const requestBody = {
            model: this.model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1000
        };

        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            // Different auth headers for different providers
            if (this.provider === 'anthropic') {
                headers['x-api-key'] = this.apiKey;
                headers['anthropic-version'] = '2023-06-01';
            } else {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('AI API Error:', error);
            throw error;
        }
    }

    /**
     * Summarize content using AI
     */
    async summarize(content, options = {}) {
        const language = options.language || 'auto';
        const maxLength = options.maxLength || 300;

        const systemPrompt = language === 'zh'
            ? `你是一个专业的内容摘要助手。请用简洁的中文总结以下内容，突出关键信息，控制在${maxLength}字以内。`
            : language === 'en'
                ? `You are a professional content summarizer. Summarize the following content concisely, highlighting key information, within ${maxLength} words.`
                : `You are a bilingual content summarizer. Summarize the following content concisely in the same language as the original content, highlighting key information, within ${maxLength} words/characters.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please summarize this content:\n\n${content}` }
        ];

        return await this.callAPI(messages, { temperature: 0.5, maxTokens: 500 });
    }

    /**
     * Analyze prompt quality and provide suggestions
     */
    async analyzePromptQuality(prompt) {
        const systemPrompt = `你是一个提示词质量分析专家。请分析以下提示词的质量，并以JSON格式返回分析结果。

Return format:
{
    "clarity": 1-10,
    "specificity": 1-10,
    "completeness": 1-10,
    "overall": 1-10,
    "suggestions": ["suggestion1", "suggestion2"],
    "improvedPrompt": "improved version of the prompt"
}

只返回JSON，不要其他文字。`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this prompt:\n\n${prompt}` }
        ];

        const response = await this.callAPI(messages, { temperature: 0.3, maxTokens: 800 });

        try {
            // Try to parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse quality analysis:', e);
        }

        return {
            clarity: 5,
            specificity: 5,
            completeness: 5,
            overall: 5,
            suggestions: ['Unable to analyze - please check AI configuration'],
            improvedPrompt: prompt
        };
    }

    /**
     * Fuse multiple contexts into a coherent summary
     */
    async fuseContexts(contexts) {
        if (!contexts || contexts.length === 0) {
            return '';
        }

        if (contexts.length === 1) {
            return contexts[0].description || contexts[0].selection || '';
        }

        const contextTexts = contexts.map((ctx, i) => {
            const content = ctx.selection || ctx.description || ctx.chatContent || '';
            return `【Context ${i + 1}: ${ctx.title}】\n${content}`;
        }).join('\n\n---\n\n');

        const systemPrompt = `你是一个智能上下文融合助手。请分析以下多个来源的上下文信息，找出它们之间的关联，并生成一个连贯的融合摘要。

要求：
1. 识别共同主题和关键信息
2. 保留重要细节
3. 用流畅的语言组织
4. 控制在500字以内`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请融合以下上下文：\n\n${contextTexts}` }
        ];

        return await this.callAPI(messages, { temperature: 0.5, maxTokens: 800 });
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const messages = [
                { role: 'user', content: 'Hello, please respond with "OK" to confirm connection.' }
            ];
            const response = await this.callAPI(messages, { maxTokens: 10 });
            return { success: true, message: response };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

// Export providers for UI
export { API_PROVIDERS };

// Export singleton instance
export const aiService = new AIService();

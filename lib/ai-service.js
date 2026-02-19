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
        const isAnthropic = this.provider === 'anthropic';
        const endpoint = isAnthropic
            ? `${baseUrl}/messages`
            : `${baseUrl}/chat/completions`;

        let requestBody;
        const headers = { 'Content-Type': 'application/json' };

        if (isAnthropic) {
            // Anthropic Messages API format
            headers['x-api-key'] = this.apiKey;
            headers['anthropic-version'] = '2023-06-01';
            const systemMsg = messages.find(m => m.role === 'system');
            const userMsgs = messages.filter(m => m.role !== 'system');
            requestBody = {
                model: this.model,
                max_tokens: options.maxTokens || 1000,
                messages: userMsgs
            };
            if (systemMsg) requestBody.system = systemMsg.content;
        } else {
            // OpenAI-compatible format (OpenAI, DeepSeek, Qwen, Custom)
            headers['Authorization'] = `Bearer ${this.apiKey}`;
            requestBody = {
                model: this.model,
                messages: messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 1000
            };
        }

        try {
            console.log('[ContextPrompt AI] Calling:', endpoint, 'model:', this.model);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errMsg = errorData.error?.message || errorData.message || `API request failed: ${response.status}`;
                console.error('[ContextPrompt AI] API error:', response.status, errMsg);
                throw new Error(errMsg);
            }

            const data = await response.json();

            // Handle different response formats
            if (isAnthropic) {
                return data.content?.[0]?.text || '';
            }
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('[ContextPrompt AI] Error:', error);
            throw error;
        }
    }

    /**
     * Summarize content using AI
     */
    async summarize(content, options = {}) {
        const language = options.language || 'auto';
        const maxLength = options.maxLength || 500;

        // For long content, chunk it to stay within token limits
        const contentToSummarize = content.length > 12000
            ? content.substring(0, 12000) + '\n\n...(remaining content omitted for summarization)'
            : content;

        const systemPrompt = language === 'zh'
            ? `你是一个专业的内容分析助手。请对以下网页内容进行全面的总结归纳：
1. 提炼核心主题和关键论点
2. 列出重要的数据、事实或结论
3. 保留关键的技术细节、代码片段说明或专业术语
4. 如有多个章节，按逻辑结构组织摘要
控制在${maxLength}字以内，使用清晰的结构化格式。`
            : language === 'en'
                ? `You are a professional content analyst. Provide a comprehensive summary of the following web page content:
1. Extract core themes and key arguments
2. List important data, facts, or conclusions
3. Preserve key technical details, code explanations, or domain terminology
4. Organize by logical structure if multiple sections exist
Keep within ${maxLength} words, use clear structured format.`
                : `You are a bilingual content analyst. Provide a comprehensive summary of the following web page content in the same language as the original:
1. Extract core themes and key arguments
2. List important data, facts, or conclusions
3. Preserve key technical details and domain terminology
4. Organize by logical structure if multiple sections exist
Keep within ${maxLength} words/characters, use clear structured format.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please analyze and summarize:\n\n${contentToSummarize}` }
        ];

        return await this.callAPI(messages, {
            temperature: 0.3,
            maxTokens: Math.min(Math.max(maxLength * 2, 800), 2000)
        });
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

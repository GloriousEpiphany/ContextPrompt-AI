/**
 * ContextPrompt AI - Context Capture Script
 * Runs on all pages to capture context when requested
 */

(function () {
    'use strict';

    // Avoid duplicate initialization
    if (window.__contextPromptCaptureInit) return;
    window.__contextPromptCaptureInit = true;

    // AI Chat Platform Configurations for content extraction
    const AI_CHAT_EXTRACTORS = {
        'chat.qwen.ai': {
            name: '通义千问',
            messageSelectors: [
                '[class*="message-content"]',
                '[class*="chat-message"]',
                '[class*="markdown-body"]',
                '.message-item',
                '[data-message-id]'
            ],
            userIndicators: ['user', 'human', '用户'],
            assistantIndicators: ['assistant', 'bot', 'ai', 'qwen', '助手'],
            isPrivateLink: (url) => /\/c\/[a-f0-9-]+/.test(url)
        },
        'www.doubao.com': {
            name: '豆包',
            messageSelectors: [
                '[class*="message"]',
                '[class*="chat-content"]',
                '[class*="conversation-item"]',
                '.message-wrapper'
            ],
            userIndicators: ['user', 'human', '用户'],
            assistantIndicators: ['assistant', 'bot', 'doubao', '豆包'],
            isPrivateLink: (url) => /\/chat\//.test(url)
        },
        'chat.openai.com': {
            name: 'ChatGPT',
            messageSelectors: [
                '[data-message-author-role]',
                '.message',
                '[class*="ConversationItem"]'
            ],
            userIndicators: ['user'],
            assistantIndicators: ['assistant'],
            isPrivateLink: (url) => /\/c\/[a-f0-9-]+/.test(url)
        },
        'chatgpt.com': {
            name: 'ChatGPT',
            messageSelectors: [
                '[data-message-author-role]',
                '.message',
                '[class*="ConversationItem"]'
            ],
            userIndicators: ['user'],
            assistantIndicators: ['assistant'],
            isPrivateLink: (url) => /\/c\/[a-f0-9-]+/.test(url)
        },
        'claude.ai': {
            name: 'Claude',
            messageSelectors: [
                '[class*="Message"]',
                '[class*="prose"]',
                '.message-content'
            ],
            userIndicators: ['human', 'user'],
            assistantIndicators: ['assistant', 'claude'],
            isPrivateLink: (url) => /\/chat\/[a-f0-9-]+/.test(url)
        },
        'gemini.google.com': {
            name: 'Gemini',
            messageSelectors: [
                '[class*="message"]',
                '.conversation-turn',
                '[data-message-id]'
            ],
            userIndicators: ['user'],
            assistantIndicators: ['model', 'gemini'],
            isPrivateLink: (url) => /\/app\/[a-f0-9]+/.test(url)
        }
    };

    /**
     * Get AI chat platform config for current site
     */
    function getAIChatConfig() {
        const hostname = window.location.hostname;
        return AI_CHAT_EXTRACTORS[hostname] || null;
    }

    /**
     * Check if current page is a private AI chat link
     */
    function isPrivateAIChatLink() {
        const config = getAIChatConfig();
        if (!config) return false;
        return config.isPrivateLink(window.location.href);
    }

    /**
     * Extract chat messages from AI platform with enhanced depth
     * @param {object} options - Capture options
     */
    function extractChatContent(options = {}) {
        const config = getAIChatConfig();
        if (!config) return '';

        // Configurable limits based on capture depth
        const limits = {
            light: { maxChars: 500, maxMessages: 10 },
            standard: { maxChars: 1500, maxMessages: 20 },
            deep: { maxChars: 3000, maxMessages: 30 }
        };
        const depth = options.captureDepth || 'standard';
        const { maxChars, maxMessages } = limits[depth] || limits.standard;

        const messages = [];

        // Try each selector until we find messages
        for (const selector of config.messageSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach((el) => {
                    // Extract structured content (preserve code blocks)
                    const structuredContent = extractStructuredContent(el);

                    if (structuredContent && structuredContent.length > 10) {
                        // Determine role from element attributes or parent
                        let role = 'message';
                        const elementHTML = el.outerHTML.toLowerCase();
                        const parentHTML = el.parentElement?.outerHTML?.toLowerCase() || '';

                        if (config.userIndicators.some(ind =>
                            elementHTML.includes(ind) || parentHTML.includes(ind))) {
                            role = 'user';
                        } else if (config.assistantIndicators.some(ind =>
                            elementHTML.includes(ind) || parentHTML.includes(ind))) {
                            role = 'assistant';
                        }

                        // Truncate if needed but preserve structure
                        let content = structuredContent;
                        if (content.length > maxChars) {
                            content = content.substring(0, maxChars) + '\n...(truncated)';
                        }

                        messages.push({ role, content });
                    }
                });
                break; // Use first successful selector
            }
        }

        // Format messages for output
        if (messages.length === 0) return '';

        // Limit to maxMessages
        const recentMessages = messages.slice(-maxMessages);

        return recentMessages.map(msg => {
            const roleLabel = msg.role === 'user' ? '👤 用户' :
                msg.role === 'assistant' ? '🤖 AI' : '💬';
            return `${roleLabel}: ${msg.content}`;
        }).join('\n\n');
    }

    /**
     * Extract content with structure preservation (code blocks, lists, etc.)
     */
    function extractStructuredContent(element) {
        const parts = [];

        // Find and extract code blocks first
        const codeBlocks = element.querySelectorAll('pre, code');
        const codeContents = new Set();
        codeBlocks.forEach(code => {
            const codeText = code.textContent?.trim();
            if (codeText && codeText.length > 20) {
                codeContents.add(codeText);
            }
        });

        // Get full text content
        let fullText = element.textContent?.trim() || '';

        // If there are code blocks, format them specially
        if (codeContents.size > 0) {
            // Replace code in text with markers, then add formatted code blocks
            codeContents.forEach((code, index) => {
                const marker = `[CODE_BLOCK_${index}]`;
                fullText = fullText.replace(code, marker);
            });

            // Add code blocks at the end with proper formatting
            let codeIndex = 0;
            codeContents.forEach(code => {
                const truncatedCode = code.length > 800 ? code.substring(0, 800) + '\n...(code truncated)' : code;
                fullText = fullText.replace(`[CODE_BLOCK_${codeIndex}]`, `\n\`\`\`\n${truncatedCode}\n\`\`\`\n`);
                codeIndex++;
            });
        }

        return fullText;
    }

    /**
     * Extract all available context from the current page
     * @param {object} options - Capture options including captureDepth
     */
    function extractPageContext(options = {}) {
        const isPrivate = isPrivateAIChatLink();
        const chatContent = isPrivate ? extractChatContent(options) : '';

        return {
            title: extractTitle(),
            url: window.location.href,
            selection: extractSelection(),
            description: extractDescription(),
            ogData: extractOpenGraphData(),
            timestamp: new Date().toISOString(),
            // New fields for AI chat support
            isPrivateLink: isPrivate,
            chatContent: chatContent,
            platformName: getAIChatConfig()?.name || ''
        };
    }

    /**
     * Extract page title (prefer OG title, fallback to document title)
     */
    function extractTitle() {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) {
            return ogTitle.content.trim();
        }
        return document.title.trim() || 'Untitled Page';
    }

    /**
     * Extract currently selected text
     */
    function extractSelection() {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            return selection.toString().trim();
        }
        return '';
    }

    /**
     * Extract meta description
     */
    function extractDescription() {
        // Try OG description first
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && ogDesc.content) {
            return ogDesc.content.trim();
        }

        // Fallback to standard meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && metaDesc.content) {
            return metaDesc.content.trim();
        }

        // Last resort: extract first paragraph
        const firstP = document.querySelector('article p, main p, .content p, p');
        if (firstP && firstP.textContent) {
            const text = firstP.textContent.trim();
            return text.length > 300 ? text.substring(0, 300) + '...' : text;
        }

        return '';
    }

    /**
     * Extract Open Graph metadata
     */
    function extractOpenGraphData() {
        const ogData = {};
        const ogTags = document.querySelectorAll('meta[property^="og:"]');

        ogTags.forEach(tag => {
            const property = tag.getAttribute('property').replace('og:', '');
            ogData[property] = tag.content;
        });

        return ogData;
    }

    /**
     * Get article main content for summarization with enhanced extraction
     * @param {object} options - Capture options
     */
    function extractMainContent(options = {}) {
        // Configurable limits based on capture depth
        const limits = {
            light: 3000,
            standard: 8000,
            deep: 15000
        };
        const depth = options.captureDepth || 'standard';
        const maxChars = limits[depth] || limits.standard;

        // Common article/content selectors (more comprehensive)
        const selectors = [
            'article',
            '[role="main"]',
            'main',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content',
            '#content',
            '.markdown-body',
            '.prose',
            '[class*="article"]',
            '[class*="post-body"]'
        ];

        let mainElement = null;
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.length > 200) {
                mainElement = element;
                break;
            }
        }

        // Fallback to body
        if (!mainElement) {
            mainElement = document.body;
        }

        // Use structured extraction
        let content = extractStructuredContent(mainElement);

        // Clean up excessive whitespace
        content = content.replace(/\s+/g, ' ').trim();

        // Truncate if needed
        if (content.length > maxChars) {
            content = content.substring(0, maxChars) + '\n...(content truncated)';
        }

        return content;
    }

    // Listen for messages from popup or service worker
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'captureContext') {
            const options = message.options || {};
            const context = extractPageContext(options);
            context.mainContent = extractMainContent(options);
            context.captureDepth = options.captureDepth || 'standard';
            sendResponse({ success: true, context });
        }
        return true;
    });

    // Log initialization
    console.log('✨ ContextPrompt AI Capture script loaded');
})();

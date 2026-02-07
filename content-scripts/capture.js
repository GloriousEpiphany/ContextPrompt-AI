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
     * Extract chat messages from AI platform
     */
    function extractChatContent() {
        const config = getAIChatConfig();
        if (!config) return '';

        const messages = [];

        // Try each selector until we find messages
        for (const selector of config.messageSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach((el, index) => {
                    const text = el.textContent?.trim();
                    if (text && text.length > 10) {
                        // Try to determine role from element attributes or parent
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

                        messages.push({
                            role,
                            content: text.length > 500 ? text.substring(0, 500) + '...' : text
                        });
                    }
                });
                break; // Use first successful selector
            }
        }

        // Format messages for output
        if (messages.length === 0) return '';

        // Limit to last 10 messages to avoid overwhelming the prompt
        const recentMessages = messages.slice(-10);

        return recentMessages.map(msg => {
            const roleLabel = msg.role === 'user' ? '👤 用户' :
                msg.role === 'assistant' ? '🤖 AI' : '💬';
            return `${roleLabel}: ${msg.content}`;
        }).join('\n\n');
    }

    /**
     * Extract all available context from the current page
     */
    function extractPageContext() {
        const isPrivate = isPrivateAIChatLink();
        const chatContent = isPrivate ? extractChatContent() : '';

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
     * Get article main content for summarization
     */
    function extractMainContent() {
        // Common article/content selectors
        const selectors = [
            'article',
            '[role="main"]',
            'main',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content',
            '#content'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                // Get text content, clean up whitespace
                let text = element.textContent || '';
                text = text.replace(/\s+/g, ' ').trim();
                // Limit to 5000 chars for processing
                return text.length > 5000 ? text.substring(0, 5000) : text;
            }
        }

        // Fallback: get body text
        let bodyText = document.body.textContent || '';
        bodyText = bodyText.replace(/\s+/g, ' ').trim();
        return bodyText.length > 5000 ? bodyText.substring(0, 5000) : bodyText;
    }

    // Listen for messages from popup or service worker
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'captureContext') {
            const context = extractPageContext();
            context.mainContent = extractMainContent();
            sendResponse({ success: true, context });
        }
        return true;
    });

    // Log initialization
    console.log('✨ ContextPrompt AI Capture script loaded');
})();

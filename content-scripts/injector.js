/**
 * ContextPrompt AI - Injector Script
 * Injects "✨ Craft Prompt" button into AI chat platforms
 */

(function () {
    'use strict';

    // Avoid duplicate initialization
    if (window.__contextPromptInjectorInit) return;
    window.__contextPromptInjectorInit = true;

    // Platform-specific configurations
    const PLATFORM_CONFIGS = {
        'chat.openai.com': {
            name: 'ChatGPT',
            inputSelector: '#prompt-textarea',
            containerSelector: 'form',
            insertPosition: 'before', // before the input
            inputType: 'textarea'
        },
        'chatgpt.com': {
            name: 'ChatGPT',
            inputSelector: '#prompt-textarea',
            containerSelector: 'form',
            insertPosition: 'before',
            inputType: 'textarea'
        },
        'claude.ai': {
            name: 'Claude',
            inputSelector: '[contenteditable="true"]',
            containerSelector: 'fieldset, form, .composer',
            insertPosition: 'before',
            inputType: 'contenteditable'
        },
        'gemini.google.com': {
            name: 'Gemini',
            inputSelector: 'div[role="textbox"], rich-textarea',
            containerSelector: '.input-area, form',
            insertPosition: 'before',
            inputType: 'contenteditable'
        },
        'chat.qwen.ai': {
            name: '通义千问',
            inputSelector: 'textarea, [contenteditable="true"]',
            containerSelector: '.chat-input, form, .input-wrapper',
            insertPosition: 'before',
            inputType: 'auto'
        },
        'www.doubao.com': {
            name: '豆包',
            inputSelector: 'textarea, [contenteditable="true"], .chat-input textarea',
            containerSelector: '.chat-input-container, form, .input-area',
            insertPosition: 'before',
            inputType: 'auto'
        }
    };

    // Get current platform config
    function getPlatformConfig() {
        const hostname = window.location.hostname;
        return PLATFORM_CONFIGS[hostname] || null;
    }

    // Create the inject button
    function createInjectButton() {
        const btn = document.createElement('button');
        btn.id = 'contextprompt-btn';
        btn.type = 'button';
        btn.className = 'contextprompt-inject-btn';
        btn.innerHTML = `
      <span class="contextprompt-icon">✨</span>
      <span class="contextprompt-text">Craft Prompt</span>
    `;
        btn.title = 'Insert context-aware prompt / 插入上下文感知提示词';

        btn.addEventListener('click', handleButtonClick);
        return btn;
    }

    // Handle button click
    async function handleButtonClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const btn = document.getElementById('contextprompt-btn');
        if (btn) {
            btn.classList.add('contextprompt-loading');
        }

        try {
            // Get the latest context from service worker
            const context = await chrome.runtime.sendMessage({ action: 'getLatestContext' });

            if (!context) {
                showNotification('No captured context. Visit any page → click extension icon to save!\n没有已捕获的上下文。请访问任意页面 → 点击插件图标保存！', 'warning');
                return;
            }

            // Get settings and templates
            const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
            const templates = await chrome.runtime.sendMessage({ action: 'getTemplates' });

            // Find the selected template
            const template = templates.find(t => t.id === settings.defaultTemplate) || templates[0];

            // Generate the prompt
            const prompt = generatePrompt(context, template);

            // Insert into the input
            await insertPrompt(prompt);

            showNotification('Prompt inserted! / 提示词已插入！', 'success');
        } catch (error) {
            console.error('ContextPrompt AI Error:', error);
            showNotification('Error: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.classList.remove('contextprompt-loading');
            }
        }
    }

    // Generate prompt from context and template
    function generatePrompt(context, template) {
        let prompt = template.template;

        // Create summary from available content
        const summary = createSummary(context);

        // Create chat summary for AI conversations
        const chatSummary = context.chatContent || '(无对话内容可用 / No chat content available)';

        // Replace placeholders
        prompt = prompt.replace(/\{title\}/g, context.title || 'Untitled');
        prompt = prompt.replace(/\{url\}/g, context.url || '');
        prompt = prompt.replace(/\{summary\}/g, summary);
        prompt = prompt.replace(/\{selection\}/g, context.selection || '(No text selected / 未选择文本)');
        prompt = prompt.replace(/\{query\}/g, '[Type your question here / 在此输入您的问题]');
        prompt = prompt.replace(/\{description\}/g, context.description || '');
        prompt = prompt.replace(/\{chatSummary\}/g, chatSummary);

        // If this is a private link but using a non-chat template, add a warning
        if (context.isPrivateLink && !template.id.includes('chat') && context.chatContent) {
            const platformName = context.platformName || 'AI 平台';
            const warning = `\n\n⚠️ 注意：以上内容来自 ${platformName} 的私有对话，原始链接无法被其他 AI 访问。`;
            prompt += warning;
        }

        return prompt;
    }

    // Create summary from context (simple rule-based NLP)
    function createSummary(context) {
        // Priority: selection > description > og data
        if (context.selection && context.selection.length > 50) {
            return truncateText(context.selection, 500);
        }

        if (context.description) {
            return truncateText(context.description, 300);
        }

        if (context.ogData && context.ogData.description) {
            return truncateText(context.ogData.description, 300);
        }

        return 'No detailed content available / 无详细内容可用';
    }

    // Truncate text to max length
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    // Insert prompt into the input field
    async function insertPrompt(prompt) {
        const config = getPlatformConfig();
        if (!config) return;

        const input = document.querySelector(config.inputSelector);
        if (!input) {
            throw new Error('Input field not found');
        }

        // Focus the input
        input.focus();

        // Determine input type
        const isContentEditable = input.hasAttribute('contenteditable') ||
            input.getAttribute('contenteditable') === 'true';

        if (isContentEditable) {
            // For contenteditable elements (Claude, Gemini, etc.)
            // Clear existing content first if empty placeholder
            if (input.textContent.trim() === '' || input.querySelector('[data-placeholder]')) {
                input.innerHTML = '';
            }

            // Insert text
            const textNode = document.createTextNode(prompt);
            input.appendChild(textNode);

            // Trigger input event for React/Vue apps
            input.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: prompt
            }));
        } else {
            // For textarea elements (ChatGPT, Qwen, etc.)
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, 'value'
            ).set;

            nativeInputValueSetter.call(input, prompt);

            // Trigger input event
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Move cursor to the query placeholder
        const queryPlaceholder = '[Type your question here / 在此输入您的问题]';
        if (prompt.includes(queryPlaceholder)) {
            // Try to select the placeholder for easy replacement
            setTimeout(() => {
                if (isContentEditable) {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    const textContent = input.textContent;
                    const startIndex = textContent.indexOf(queryPlaceholder);
                    if (startIndex >= 0) {
                        // Find the text node containing the placeholder
                        const walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT);
                        let currentNode;
                        let currentIndex = 0;
                        while (currentNode = walker.nextNode()) {
                            const nodeLength = currentNode.textContent.length;
                            if (currentIndex + nodeLength > startIndex) {
                                const offset = startIndex - currentIndex;
                                range.setStart(currentNode, offset);
                                range.setEnd(currentNode, offset + queryPlaceholder.length);
                                selection.removeAllRanges();
                                selection.addRange(range);
                                break;
                            }
                            currentIndex += nodeLength;
                        }
                    }
                } else {
                    const startIndex = prompt.indexOf(queryPlaceholder);
                    if (startIndex >= 0) {
                        input.setSelectionRange(startIndex, startIndex + queryPlaceholder.length);
                    }
                }
            }, 100);
        }
    }

    // Show notification toast
    function showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.contextprompt-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `contextprompt-notification contextprompt-notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Inject the button
    function injectButton() {
        const config = getPlatformConfig();
        if (!config) return;

        // Check if already injected
        if (document.getElementById('contextprompt-btn')) return;

        // Find the input element
        const input = document.querySelector(config.inputSelector);
        if (!input) return;

        // Find container
        let container = input.closest(config.containerSelector);
        if (!container) {
            container = input.parentElement;
        }
        if (!container) return;

        // Create and inject button
        const btn = createInjectButton();

        // Create a wrapper for better positioning
        const wrapper = document.createElement('div');
        wrapper.className = 'contextprompt-btn-wrapper';
        wrapper.appendChild(btn);

        // Insert based on configuration
        if (config.insertPosition === 'before') {
            container.insertBefore(wrapper, container.firstChild);
        } else {
            container.appendChild(wrapper);
        }

        console.log(`✨ ContextPrompt AI button injected into ${config.name}`);
    }

    // Check injection settings before injecting
    async function checkAndInject() {
        try {
            const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
            if (settings && settings.enableInjection !== false) {
                injectButton();
            }
        } catch (error) {
            // If settings check fails, inject anyway
            injectButton();
        }
    }

    // Use MutationObserver to handle SPA navigation and dynamic loading
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            // Debounce: only run if button not present
            if (!document.getElementById('contextprompt-btn')) {
                checkAndInject();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }

    // Initialize
    function init() {
        // Initial injection attempt
        checkAndInject();

        // Setup observer for dynamic content
        setupObserver();

        // Also try after a short delay (for slow-loading SPAs)
        setTimeout(checkAndInject, 1000);
        setTimeout(checkAndInject, 3000);
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✨ ContextPrompt AI Injector script loaded');
})();

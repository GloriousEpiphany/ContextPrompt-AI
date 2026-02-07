/**
 * ContextPrompt AI - Context Capture Script
 * Runs on all pages to capture context when requested
 */

(function () {
    'use strict';

    // Avoid duplicate initialization
    if (window.__contextPromptCaptureInit) return;
    window.__contextPromptCaptureInit = true;

    /**
     * Extract all available context from the current page
     */
    function extractPageContext() {
        return {
            title: extractTitle(),
            url: window.location.href,
            selection: extractSelection(),
            description: extractDescription(),
            ogData: extractOpenGraphData(),
            timestamp: new Date().toISOString()
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

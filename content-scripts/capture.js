/**
 * ContextPrompt AI - Context Capture Script v3.1
 * Readability-inspired content extraction for any web page
 * Supports: blogs, news, docs, forums, AI chat platforms
 */

(function () {
    'use strict';

    if (window.__contextPromptCaptureInit) return;
    window.__contextPromptCaptureInit = true;

    // ==================== Constants ====================

    const UNLIKELY_RE = /combx|comment|community|disqus|extra|foot|header|menu|remark|rss|sharedadder|sidebar|sponsor|ad-break|agegate|pagination|pager|popup|tweet|breadcrumb|widget|share|social|related|tag-cloud|cookie|banner|newsletter|masthead|outbrain|promo|shopping|tool/i;
    const POSITIVE_RE = /article|body|content|entry|hentry|main|page|post|text|blog|story|prose|markdown|reading/i;
    const NEGATIVE_RE = /hidden|combx|comment|com-|contact|foot|footer|footnote|media|meta|related|scroll|sidebar|sponsor|tags|widget|nav|menu|ad|banner/i;

    const REMOVE_TAGS = new Set([
        'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
        'video', 'audio', 'object', 'embed', 'applet'
    ]);
    const VOID_BLOCK_TAGS = new Set([
        'address', 'article', 'aside', 'blockquote', 'details', 'div',
        'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup',
        'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
        'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'ul', 'dd', 'dt'
    ]);

    // ==================== AI Chat Extractors ====================

    const AI_CHAT_EXTRACTORS = {
        'chat.qwen.ai': {
            name: '通义千问',
            messageSelectors: [
                '[class*="message-content"]', '[class*="chat-message"]',
                '[class*="markdown-body"]', '.message-item', '[data-message-id]'
            ],
            userIndicators: ['user', 'human', '用户'],
            assistantIndicators: ['assistant', 'bot', 'ai', 'qwen', '助手'],
            isPrivateLink: (url) => /\/c\/[a-f0-9-]+/.test(url)
        },
        'www.doubao.com': {
            name: '豆包',
            messageSelectors: [
                '[class*="message"]', '[class*="chat-content"]',
                '[class*="conversation-item"]', '.message-wrapper'
            ],
            userIndicators: ['user', 'human', '用户'],
            assistantIndicators: ['assistant', 'bot', 'doubao', '豆包'],
            isPrivateLink: (url) => /\/chat\//.test(url)
        },
        'chat.openai.com': {
            name: 'ChatGPT',
            messageSelectors: [
                '[data-message-author-role]', '.message', '[class*="ConversationItem"]'
            ],
            userIndicators: ['user'],
            assistantIndicators: ['assistant'],
            isPrivateLink: (url) => /\/c\/[a-f0-9-]+/.test(url)
        },
        'chatgpt.com': {
            name: 'ChatGPT',
            messageSelectors: [
                '[data-message-author-role]', '.message', '[class*="ConversationItem"]'
            ],
            userIndicators: ['user'],
            assistantIndicators: ['assistant'],
            isPrivateLink: (url) => /\/c\/[a-f0-9-]+/.test(url)
        },
        'claude.ai': {
            name: 'Claude',
            messageSelectors: [
                '[class*="Message"]', '[class*="prose"]', '.message-content'
            ],
            userIndicators: ['human', 'user'],
            assistantIndicators: ['assistant', 'claude'],
            isPrivateLink: (url) => /\/chat\/[a-f0-9-]+/.test(url)
        },
        'gemini.google.com': {
            name: 'Gemini',
            messageSelectors: [
                '[class*="message"]', '.conversation-turn', '[data-message-id]'
            ],
            userIndicators: ['user'],
            assistantIndicators: ['model', 'gemini'],
            isPrivateLink: (url) => /\/app\/[a-f0-9]+/.test(url)
        }
    };

    // ==================== Readability Algorithm ====================

    /**
     * Get class string safely (handles SVGAnimatedString)
     */
    function getClassStr(el) {
        if (!el) return '';
        const cls = el.getAttribute ? el.getAttribute('class') : '';
        return cls || '';
    }

    /**
     * Check if a node contains only inline content (text, a, span, em, strong, etc.)
     * Used to identify div elements that act as paragraphs
     */
    function hasOnlyInlineContent(node) {
        const INLINE_TAGS = new Set([
            'a', 'abbr', 'b', 'bdo', 'big', 'br', 'cite', 'code', 'dfn',
            'em', 'i', 'img', 'input', 'kbd', 'label', 'mark', 'q',
            's', 'samp', 'small', 'span', 'strong', 'sub', 'sup',
            'time', 'tt', 'u', 'var', 'wbr'
        ]);
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) continue;
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            if (!INLINE_TAGS.has(child.tagName.toLowerCase())) return false;
        }
        return true;
    }

    /**
     * Create a clean clone of the DOM for analysis (avoid mutating live DOM)
     */
    function prepareDOM() {
        const clone = document.cloneNode(true);

        // Remove unwanted tags entirely
        REMOVE_TAGS.forEach(tag => {
            clone.querySelectorAll(tag).forEach(el => el.remove());
        });

        // Remove hidden elements
        clone.querySelectorAll('[style]').forEach(el => {
            const s = el.getAttribute('style') || '';
            if (/display\s*:\s*none/i.test(s) || /visibility\s*:\s*hidden/i.test(s)) {
                el.remove();
            }
        });
        clone.querySelectorAll('[hidden], [aria-hidden="true"]').forEach(el => el.remove());

        // Remove unlikely candidates by class/id
        clone.querySelectorAll('*').forEach(el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'body' || tag === 'html' || tag === 'article' || tag === 'main') return;
            const combo = getClassStr(el) + ' ' + (el.id || '');
            if (UNLIKELY_RE.test(combo) && !POSITIVE_RE.test(combo)) {
                const text = el.textContent || '';
                if (text.length < 300) {
                    el.remove();
                }
            }
        });

        // Convert div-as-paragraph: div elements with only inline content → p
        clone.querySelectorAll('div').forEach(div => {
            if (hasOnlyInlineContent(div) && (div.textContent || '').trim().length > 10) {
                const p = clone.createElement ? clone.createElement('p') : document.createElement('p');
                p.innerHTML = div.innerHTML;
                div.parentNode?.replaceChild(p, div);
            }
        });

        return clone;
    }

    /**
     * Calculate link density of a node (ratio of link text to total text)
     */
    function getLinkDensity(node) {
        const textLen = (node.textContent || '').length;
        if (textLen === 0) return 0;
        let linkLen = 0;
        node.querySelectorAll('a').forEach(a => {
            linkLen += (a.textContent || '').length;
        });
        return linkLen / textLen;
    }

    /**
     * Score a node for content likelihood
     */
    function scoreNode(node) {
        let score = 0;
        const tag = node.tagName?.toLowerCase() || '';
        const combo = (getClassStr(node) + ' ' + (node.id || '')).toLowerCase();

        // Tag-based scoring
        if (tag === 'article') score += 30;
        else if (tag === 'main') score += 25;
        else if (tag === 'section') score += 10;
        else if (tag === 'div') score += 5;
        else if (tag === 'pre' || tag === 'blockquote') score += 3;
        else if (tag === 'td' || tag === 'th') score += 3;
        else if (tag === 'form' || tag === 'nav' || tag === 'aside') score -= 20;
        else if (tag === 'header' || tag === 'footer') score -= 15;

        // Class/ID based scoring
        if (POSITIVE_RE.test(combo)) score += 25;
        if (NEGATIVE_RE.test(combo)) score -= 25;

        return score;
    }

    /**
     * Score paragraphs and propagate scores to parent nodes
     * Core of the Readability algorithm
     */
    function findBestContentNode(root) {
        const candidates = new Map();
        // Include div elements - many modern pages use div instead of p
        const paragraphs = root.querySelectorAll('p, pre, td, blockquote, div');

        paragraphs.forEach(p => {
            const text = (p.textContent || '').trim();
            if (text.length < 25) return;

            const tag = p.tagName.toLowerCase();
            // For div elements, only score those that look like content containers
            if (tag === 'div') {
                // Skip divs that are just wrappers (have many block-level children)
                const blockChildren = p.querySelectorAll(':scope > div, :scope > section, :scope > article, :scope > aside, :scope > nav, :scope > header, :scope > footer');
                if (blockChildren.length > 3) return;
                // Skip divs with very high link density
                if (getLinkDensity(p) > 0.5) return;
            }

            const parent = p.parentElement;
            const grandParent = parent?.parentElement;
            if (!parent) return;

            // Initialize candidate scores
            if (!candidates.has(parent)) {
                candidates.set(parent, scoreNode(parent));
            }
            if (grandParent && !candidates.has(grandParent)) {
                candidates.set(grandParent, scoreNode(grandParent));
            }

            // Content score based on text quality
            let contentScore = 1;
            // Bonus for commas (natural language indicator)
            contentScore += (text.match(/[,，、。.!！?？;；]/g) || []).length * 0.5;
            // Bonus for text length (diminishing returns)
            contentScore += Math.min(Math.floor(text.length / 100), 3);
            // Bonus for Chinese text density (Chinese text has fewer spaces)
            const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
            if (chineseChars > 20) contentScore += 2;

            candidates.set(parent, candidates.get(parent) + contentScore);
            if (grandParent) {
                candidates.set(grandParent, candidates.get(grandParent) + contentScore / 2);
            }
        });

        // Also directly score elements with semantic selectors
        ['article', 'main', '[role="main"]'].forEach(sel => {
            try {
                const el = root.querySelector(sel);
                if (el && !candidates.has(el)) {
                    candidates.set(el, scoreNode(el) + 20);
                }
            } catch { /* ignore */ }
        });

        // Find the top candidate
        let bestNode = root.body || root;
        let bestScore = -Infinity;

        candidates.forEach((score, node) => {
            // Penalize high link density
            const linkDensity = getLinkDensity(node);
            const adjustedScore = score * (1 - linkDensity);

            if (adjustedScore > bestScore) {
                bestScore = adjustedScore;
                bestNode = node;
            }
        });

        return bestNode;
    }

    // ==================== DOM → Markdown Converter ====================

    /**
     * Convert a DOM subtree to clean Markdown, preserving structure
     */
    function domToMarkdown(node) {
        if (!node) return '';
        const parts = [];
        _walkNode(node, parts, 0);
        // Clean up excessive blank lines
        return parts.join('')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\s+/, '')
            .replace(/\s+$/, '');
    }

    function _walkNode(node, parts, depth) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, ' ');
            if (text.trim()) parts.push(text);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName.toLowerCase();

        // Skip removed tags
        if (REMOVE_TAGS.has(tag)) return;

        // Headings
        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag[1]);
            const text = (node.textContent || '').trim();
            if (text) {
                parts.push('\n\n' + '#'.repeat(level) + ' ' + text + '\n\n');
            }
            return;
        }

        // Paragraphs
        if (tag === 'p') {
            parts.push('\n\n');
            _walkChildren(node, parts, depth);
            parts.push('\n\n');
            return;
        }

        // Line breaks
        if (tag === 'br') {
            parts.push('\n');
            return;
        }

        // Horizontal rule
        if (tag === 'hr') {
            parts.push('\n\n---\n\n');
            return;
        }

        // Code blocks
        if (tag === 'pre') {
            const codeEl = node.querySelector('code');
            const lang = (getClassStr(codeEl).match(/language-(\w+)/) || [])[1] || '';
            const code = (node.textContent || '').trim();
            if (code) {
                parts.push('\n\n```' + lang + '\n' + code + '\n```\n\n');
            }
            return;
        }
        if (tag === 'code' && node.parentElement?.tagName?.toLowerCase() !== 'pre') {
            const code = (node.textContent || '').trim();
            if (code) parts.push('`' + code + '`');
            return;
        }

        // Lists
        if (tag === 'ul' || tag === 'ol') {
            parts.push('\n');
            const items = node.querySelectorAll(':scope > li');
            items.forEach((li, i) => {
                const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
                const indent = '  '.repeat(depth);
                parts.push(indent + prefix);
                _walkChildren(li, parts, depth + 1);
                parts.push('\n');
            });
            parts.push('\n');
            return;
        }
        if (tag === 'li') {
            _walkChildren(node, parts, depth);
            return;
        }

        // Blockquote
        if (tag === 'blockquote') {
            parts.push('\n\n');
            const inner = [];
            _walkChildren(node, inner, depth);
            const text = inner.join('').trim();
            parts.push(text.split('\n').map(l => '> ' + l).join('\n'));
            parts.push('\n\n');
            return;
        }

        // Definition lists
        if (tag === 'dl') {
            parts.push('\n\n');
            _walkChildren(node, parts, depth);
            parts.push('\n\n');
            return;
        }
        if (tag === 'dt') {
            parts.push('\n**');
            _walkChildren(node, parts, depth);
            parts.push('**\n');
            return;
        }
        if (tag === 'dd') {
            parts.push(': ');
            _walkChildren(node, parts, depth);
            parts.push('\n');
            return;
        }

        // Figure / Figcaption
        if (tag === 'figure') {
            parts.push('\n\n');
            _walkChildren(node, parts, depth);
            parts.push('\n\n');
            return;
        }
        if (tag === 'figcaption') {
            parts.push('\n*');
            _walkChildren(node, parts, depth);
            parts.push('*\n');
            return;
        }

        // Details / Summary
        if (tag === 'details') {
            parts.push('\n\n');
            _walkChildren(node, parts, depth);
            parts.push('\n\n');
            return;
        }
        if (tag === 'summary') {
            parts.push('\n**');
            _walkChildren(node, parts, depth);
            parts.push('**\n');
            return;
        }

        // Bold / Italic
        if (tag === 'strong' || tag === 'b') {
            parts.push('**');
            _walkChildren(node, parts, depth);
            parts.push('**');
            return;
        }
        if (tag === 'em' || tag === 'i') {
            parts.push('*');
            _walkChildren(node, parts, depth);
            parts.push('*');
            return;
        }

        // Links
        if (tag === 'a') {
            const href = node.getAttribute('href') || '';
            const text = (node.textContent || '').trim();
            if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                const fullHref = href.startsWith('http') ? href : '';
                if (fullHref) {
                    parts.push('[' + text + '](' + fullHref + ')');
                } else {
                    parts.push(text);
                }
            } else if (text) {
                parts.push(text);
            }
            return;
        }

        // Images
        if (tag === 'img') {
            const alt = node.getAttribute('alt') || '';
            const src = node.getAttribute('src') || '';
            if (alt) {
                parts.push('[Image: ' + alt + ']');
            }
            return;
        }

        // Tables
        if (tag === 'table') {
            parts.push('\n\n');
            _convertTable(node, parts);
            parts.push('\n\n');
            return;
        }

        // Block-level elements: add line breaks
        if (VOID_BLOCK_TAGS.has(tag)) {
            parts.push('\n');
            _walkChildren(node, parts, depth);
            parts.push('\n');
            return;
        }

        // Default: recurse into children
        _walkChildren(node, parts, depth);
    }

    function _walkChildren(node, parts, depth) {
        node.childNodes.forEach(child => _walkNode(child, parts, depth));
    }

    /**
     * Convert HTML table to Markdown table
     */
    function _convertTable(table, parts) {
        // Only get direct rows (not from nested tables)
        const rows = table.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr');
        if (rows.length === 0) return;

        rows.forEach((row, rowIdx) => {
            const cells = row.querySelectorAll(':scope > td, :scope > th');
            const cellTexts = Array.from(cells).map(c =>
                (c.textContent || '').trim().replace(/\s+/g, ' ').replace(/\|/g, '\\|')
            );
            if (cellTexts.length === 0) return;
            parts.push('| ' + cellTexts.join(' | ') + ' |\n');
            // Add separator after header row
            if (rowIdx === 0) {
                parts.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |\n');
            }
        });
    }

    // ==================== Main Content Extraction ====================

    /**
     * Extract full page content using Readability algorithm + Markdown conversion
     * This is the core improvement: works on ANY web page
     */
    function extractFullPageContent(options = {}) {
        const depth = options.captureDepth || 'standard';
        const limits = { light: 15000, standard: 50000, deep: 150000 };
        const maxChars = limits[depth] || limits.standard;

        try {
            // Step 1: Try semantic selectors first (fast path)
            const semanticContent = trySemanticExtraction();
            if (semanticContent && semanticContent.length > 100) {
                return truncateContent(semanticContent, maxChars);
            }

            // Step 2: Readability algorithm (robust path)
            const cleanedDOM = prepareDOM();
            const contentNode = findBestContentNode(cleanedDOM);
            const markdown = domToMarkdown(contentNode);

            if (markdown.length > 100) {
                return truncateContent(markdown, maxChars);
            }

            // Step 3: Fallback - extract from body with basic cleaning
            const bodyMarkdown = domToMarkdown(cleanedDOM.body || cleanedDOM);
            if (bodyMarkdown.length > 50) {
                return truncateContent(bodyMarkdown, maxChars);
            }

            // Step 4: Last resort - raw text from live document body
            const rawText = (document.body?.innerText || '').trim();
            return truncateContent(rawText, maxChars);
        } catch (err) {
            // If anything fails, fall back to raw text extraction
            console.warn('ContextPrompt capture error:', err);
            const rawText = (document.body?.innerText || '').trim();
            return truncateContent(rawText, maxChars);
        }
    }

    /**
     * Fast path: try well-known semantic selectors
     */
    function trySemanticExtraction() {
        const selectors = [
            'article', '[role="main"]', 'main',
            '.post-content', '.article-content', '.entry-content',
            '.markdown-body', '.prose', '.post-body',
            '#content > article', '.blog-post', '.story-body',
            '[itemprop="articleBody"]', '[data-article-body]',
            '.page-content', '.doc-content', '.documentation',
            '.wiki-content', '.readme', '.rich-text',
            '#readme', '#wiki-body', '.notion-page-content'
        ];

        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el && (el.textContent || '').trim().length > 100) {
                    return domToMarkdown(el);
                }
            } catch { /* invalid selector, skip */ }
        }
        return '';
    }

    function truncateContent(content, maxChars) {
        if (content.length <= maxChars) return content;
        // Try to truncate at a paragraph boundary
        const truncated = content.substring(0, maxChars);
        const lastParagraph = truncated.lastIndexOf('\n\n');
        if (lastParagraph > maxChars * 0.8) {
            return truncated.substring(0, lastParagraph) + '\n\n...(content truncated)';
        }
        return truncated + '\n\n...(content truncated)';
    }

    // ==================== Chat Content Extraction ====================

    function getAIChatConfig() {
        return AI_CHAT_EXTRACTORS[window.location.hostname] || null;
    }

    function isPrivateAIChatLink() {
        const config = getAIChatConfig();
        if (!config) return false;
        return config.isPrivateLink(window.location.href);
    }

    function extractChatContent(options = {}) {
        const config = getAIChatConfig();
        if (!config) return '';

        const limits = {
            light: { maxChars: 500, maxMessages: 10 },
            standard: { maxChars: 1500, maxMessages: 20 },
            deep: { maxChars: 3000, maxMessages: 30 }
        };
        const depth = options.captureDepth || 'standard';
        const { maxChars, maxMessages } = limits[depth] || limits.standard;
        const messages = [];

        for (const selector of config.messageSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach(el => {
                    const content = domToMarkdown(el);
                    if (content && content.length > 10) {
                        let role = 'message';
                        const html = el.outerHTML.toLowerCase();
                        const parentHTML = el.parentElement?.outerHTML?.toLowerCase() || '';
                        if (config.userIndicators.some(ind => html.includes(ind) || parentHTML.includes(ind))) {
                            role = 'user';
                        } else if (config.assistantIndicators.some(ind => html.includes(ind) || parentHTML.includes(ind))) {
                            role = 'assistant';
                        }
                        let msg = content;
                        if (msg.length > maxChars) {
                            msg = msg.substring(0, maxChars) + '\n...(truncated)';
                        }
                        messages.push({ role, content: msg });
                    }
                });
                break;
            }
        }

        if (messages.length === 0) return '';
        const recent = messages.slice(-maxMessages);
        return recent.map(msg => {
            const label = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'AI' : 'Message';
            return `**${label}**: ${msg.content}`;
        }).join('\n\n---\n\n');
    }

    // ==================== Metadata Extraction ====================

    function extractTitle() {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle?.content) return ogTitle.content.trim();
        return document.title.trim() || 'Untitled Page';
    }

    function extractSelection() {
        const sel = window.getSelection();
        return (sel && sel.toString().trim()) ? sel.toString().trim() : '';
    }

    function extractDescription() {
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc?.content) return ogDesc.content.trim();
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc?.content) return metaDesc.content.trim();
        const firstP = document.querySelector('article p, main p, .content p, p');
        if (firstP?.textContent) {
            const text = firstP.textContent.trim();
            return text.length > 300 ? text.substring(0, 300) + '...' : text;
        }
        return '';
    }

    function extractOpenGraphData() {
        const ogData = {};
        document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
            ogData[tag.getAttribute('property').replace('og:', '')] = tag.content;
        });
        return ogData;
    }

    /**
     * Extract structured metadata (JSON-LD, microdata)
     */
    function extractStructuredData() {
        const data = {};
        // JSON-LD
        document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            try {
                const json = JSON.parse(script.textContent);
                if (json['@type']) data.type = json['@type'];
                if (json.author) data.author = typeof json.author === 'string' ? json.author : json.author.name;
                if (json.datePublished) data.datePublished = json.datePublished;
                if (json.description) data.ldDescription = json.description;
            } catch { /* ignore */ }
        });
        // Article meta
        const authorMeta = document.querySelector('meta[name="author"], [rel="author"]');
        if (authorMeta) data.author = data.author || authorMeta.content || authorMeta.textContent;
        const dateMeta = document.querySelector('meta[property="article:published_time"], time[datetime]');
        if (dateMeta) data.datePublished = data.datePublished || dateMeta.content || dateMeta.getAttribute('datetime');
        return data;
    }

    // ==================== Page Context Assembly ====================

    function extractPageContext(options = {}) {
        const isPrivate = isPrivateAIChatLink();
        const chatContent = isPrivate ? extractChatContent(options) : '';

        return {
            title: extractTitle(),
            url: window.location.href,
            selection: extractSelection(),
            description: extractDescription(),
            ogData: extractOpenGraphData(),
            structuredData: extractStructuredData(),
            timestamp: new Date().toISOString(),
            isPrivateLink: isPrivate,
            chatContent: chatContent,
            platformName: getAIChatConfig()?.name || ''
        };
    }

    // ==================== Message Listener ====================

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'captureContext') {
            try {
                const options = message.options || {};
                const context = extractPageContext(options);
                context.mainContent = extractFullPageContent(options);
                context.captureDepth = options.captureDepth || 'standard';
                sendResponse({ success: true, context });
            } catch (err) {
                // Even if extraction fails, return basic info
                sendResponse({
                    success: true,
                    context: {
                        title: document.title || 'Untitled',
                        url: window.location.href,
                        selection: (window.getSelection() || '').toString(),
                        description: '',
                        ogData: {},
                        structuredData: {},
                        mainContent: (document.body?.innerText || '').substring(0, 50000),
                        timestamp: new Date().toISOString(),
                        isPrivateLink: false,
                        chatContent: '',
                        platformName: '',
                        captureDepth: 'standard'
                    }
                });
            }
        }
        return true;
    });

    console.log('ContextPrompt AI Capture v3.1 loaded');
})();
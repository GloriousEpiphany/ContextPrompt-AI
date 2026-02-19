/**
 * ContextPrompt AI - NLP Engine
 * Lightweight rule-based NLP for local processing
 */

export class PromptEngine {
    constructor() {
        // Common stop words for English and Chinese
        this.stopWordsEn = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'and', 'or',
            'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for', 'with',
            'about', 'against', 'between', 'into', 'through', 'during', 'before',
            'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
            'on', 'off', 'over', 'under', 'again', 'further', 'once', 'here',
            'there', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
            'no', 'nor', 'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just'
        ]);

        this.stopWordsCn = new Set([
            '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
            '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
            '没有', '看', '好', '自己', '这', '那', '他', '她', '它', '们', '这个',
            '那个', '什么', '怎么', '为什么', '因为', '所以', '但是', '如果', '虽然',
            '或者', '而且', '以及', '还有', '可以', '能够', '应该', '必须', '需要'
        ]);
    }

    /**
     * Generate a prompt from context
     */
    async generatePrompt(context, template = null, userQuery = '') {
        const title = context.title || 'Untitled';
        const selection = context.selection?.trim() || '';
        const description = context.description || '';

        // Generate summary
        const summary = this.createSummary(context);

        // Use default template if not provided
        if (!template) {
            template = {
                template: `📌 Context from: {title}\n\n{summary}\n\n❓ Your query: {query}`
            };
        }

        // Apply template
        let prompt = template.template;
        // {content}: AI summary if available, otherwise full mainContent
        let contentForPrompt;
        if (context.aiSummary) {
            contentForPrompt = context.aiSummary;
        } else if (context.aiEnabled) {
            // AI enabled but no cached summary — reuse the NLP summary
            contentForPrompt = summary;
        } else {
            contentForPrompt = (context.mainContent || selection || description).substring(0, 30000);
        }

        prompt = prompt.replace(/\{title\}/g, title);
        prompt = prompt.replace(/\{url\}/g, context.url || '');
        prompt = prompt.replace(/\{summary\}/g, summary);
        prompt = prompt.replace(/\{content\}/g, contentForPrompt);
        prompt = prompt.replace(/\{selection\}/g, selection || '(No selection)');
        prompt = prompt.replace(/\{query\}/g, userQuery || '[Type your question]');
        prompt = prompt.replace(/\{description\}/g, description);

        return prompt;
    }

    /**
     * Create a summary from available context
     */
    createSummary(context) {
        // If this is a private AI chat link with chat content, prioritize that
        if (context.isPrivateLink && context.chatContent) {
            return this.summarizeChatContent(context.chatContent);
        }

        // Priority: selection > description > main content
        if (context.selection && context.selection.length > 100) {
            return this.extractKeyPoints(context.selection);
        }

        if (context.description) {
            return context.description;
        }

        if (context.mainContent) {
            return this.summarizeText(context.mainContent);
        }

        if (context.ogData && context.ogData.description) {
            return context.ogData.description;
        }

        return 'No detailed content available';
    }

    /**
     * Summarize chat content from AI platforms
     */
    summarizeChatContent(chatContent) {
        if (!chatContent || chatContent.length < 50) {
            return chatContent || 'No chat content available';
        }

        // If chat content is short enough, return as is
        if (chatContent.length <= 1000) {
            return chatContent;
        }

        // For longer content, extract key exchanges
        const lines = chatContent.split('\n\n');
        const keyExchanges = [];

        // Take first 2 and last 3 exchanges for context
        if (lines.length <= 5) {
            return chatContent;
        }

        keyExchanges.push(...lines.slice(0, 2));
        keyExchanges.push('...(对话省略 / conversation truncated)...');
        keyExchanges.push(...lines.slice(-3));

        return keyExchanges.join('\n\n');
    }

    /**
     * Extract key points from text
     */
    extractKeyPoints(text) {
        if (!text || text.length < 50) return text;

        // Split into sentences
        const sentences = this.splitSentences(text);

        if (sentences.length <= 3) {
            return text;
        }

        // Score sentences based on keyword frequency and position
        const wordFreq = this.calculateWordFrequency(text);
        const scoredSentences = sentences.map((sentence, index) => {
            const score = this.scoreSentence(sentence, wordFreq, index, sentences.length);
            return { sentence, score, index };
        });

        // Sort by score and take top 3
        scoredSentences.sort((a, b) => b.score - a.score);
        const topSentences = scoredSentences.slice(0, 3);

        // Re-order by original position
        topSentences.sort((a, b) => a.index - b.index);

        return topSentences.map(s => s.sentence).join(' ');
    }

    /**
     * Summarize longer text
     */
    summarizeText(text) {
        if (!text || text.length < 100) return text;

        // Limit input for summarization processing
        const truncated = text.length > 8000 ? text.substring(0, 8000) : text;

        return this.extractKeyPointsExtended(truncated);
    }

    /**
     * Extract more key points for better summaries (5-8 sentences)
     */
    extractKeyPointsExtended(text) {
        if (!text || text.length < 50) return text;

        const sentences = this.splitSentences(text);
        if (sentences.length <= 6) return text;

        const wordFreq = this.calculateWordFrequency(text);
        const scoredSentences = sentences.map((sentence, index) => {
            const score = this.scoreSentence(sentence, wordFreq, index, sentences.length);
            return { sentence, score, index };
        });

        scoredSentences.sort((a, b) => b.score - a.score);
        const topCount = Math.min(Math.max(5, Math.ceil(sentences.length * 0.3)), 8);
        const topSentences = scoredSentences.slice(0, topCount);
        topSentences.sort((a, b) => a.index - b.index);

        return topSentences.map(s => s.sentence).join(' ');
    }

    /**
     * Split text into sentences
     */
    splitSentences(text) {
        // Handle both English and Chinese sentence endings
        const sentenceEnders = /([.!?。！？]+[\s]*|[\n\r]+)/g;
        const sentences = text.split(sentenceEnders)
            .filter(s => s.trim().length > 10)
            .map(s => s.trim());

        return sentences;
    }

    /**
     * Calculate word frequency in text
     */
    calculateWordFrequency(text) {
        const words = this.tokenize(text);
        const freq = {};

        words.forEach(word => {
            if (!this.isStopWord(word) && word.length > 1) {
                freq[word] = (freq[word] || 0) + 1;
            }
        });

        return freq;
    }

    /**
     * Tokenize text (handles both English and Chinese)
     */
    tokenize(text) {
        // Split on whitespace and punctuation
        const tokens = text.toLowerCase()
            .split(/[\s,.!?;:'"()\[\]{}。，！？；：""''（）【】]+/)
            .filter(t => t.length > 0);

        // For Chinese, also split individual characters for short words
        const result = [];
        tokens.forEach(token => {
            // Check if token contains Chinese characters
            if (/[\u4e00-\u9fff]/.test(token)) {
                // Add both the full token and individual chars for longer words
                if (token.length > 1) {
                    result.push(token);
                }
                // Add 2-gram for Chinese
                for (let i = 0; i < token.length - 1; i++) {
                    result.push(token.substring(i, i + 2));
                }
            } else {
                result.push(token);
            }
        });

        return result;
    }

    /**
     * Check if word is a stop word
     */
    isStopWord(word) {
        return this.stopWordsEn.has(word.toLowerCase()) ||
            this.stopWordsCn.has(word);
    }

    /**
     * Score a sentence for importance
     */
    scoreSentence(sentence, wordFreq, position, totalSentences) {
        let score = 0;
        const words = this.tokenize(sentence);

        // Word frequency score
        words.forEach(word => {
            if (wordFreq[word]) {
                score += wordFreq[word];
            }
        });

        // Normalize by length
        score = score / Math.max(words.length, 1);

        // Position bonus (first and last sentences get boost)
        if (position === 0) {
            score *= 1.5; // First sentence often contains key info
        } else if (position === totalSentences - 1) {
            score *= 1.2; // Conclusion often has summary
        }

        // Length penalty for very short or very long sentences
        if (words.length < 5) {
            score *= 0.5;
        } else if (words.length > 50) {
            score *= 0.8;
        }

        return score;
    }

    /**
     * Extract keywords from text
     */
    extractKeywords(text, maxKeywords = 5) {
        const wordFreq = this.calculateWordFrequency(text);

        // Sort by frequency
        const sorted = Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxKeywords)
            .map(([word]) => word);

        return sorted;
    }

    /**
     * Detect language (simple heuristic)
     */
    detectLanguage(text) {
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const totalChars = text.length;

        if (chineseChars / totalChars > 0.1) {
            return 'zh';
        }
        return 'en';
    }

    /**
     * Check WebNN support (for future TinyML integration)
     */
    isWebNNSupported() {
        return typeof navigator !== 'undefined' && 'ml' in navigator;
    }
}

// Export singleton instance
export const promptEngine = new PromptEngine();

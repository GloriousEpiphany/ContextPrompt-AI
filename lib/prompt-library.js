/**
 * ContextPrompt AI - Prompt Library
 * Pre-built categorized prompts for common use cases
 * Category names use nameKey for i18n lookup
 */

import { t } from './i18n-helper.js';

export const PROMPT_CATEGORIES = [
  {
    id: 'code-review',
    icon: '🔍',
    nameKey: 'codeReview',
    get name() { return t('codeReview'); },
    prompts: [
      {
        id: 'cr-1',
        title: 'Review Code Quality',
        template: `Review the following code for quality, readability, and potential issues:\n\n{summary}\n\nPlease identify:\n1. Code smells or anti-patterns\n2. Performance concerns\n3. Security vulnerabilities\n4. Suggestions for improvement`
      },
      {
        id: 'cr-2',
        title: 'Explain Code',
        template: `Explain the following code in detail:\n\n{summary}\n\nBreak down:\n1. What it does\n2. How it works\n3. Key algorithms or patterns used`
      },
      {
        id: 'cr-3',
        title: 'Refactor Suggestions',
        template: `Suggest refactoring improvements for this code:\n\n{summary}\n\nFocus on:\n1. SOLID principles\n2. Design patterns\n3. Reducing complexity`
      }
    ]
  },
  {
    id: 'content-summary',
    icon: '📝',
    nameKey: 'contentSummary',
    get name() { return t('contentSummary'); },
    prompts: [
      {
        id: 'cs-1',
        title: 'Executive Summary',
        template: `Create an executive summary of the following content from "{title}":\n\n{summary}\n\nInclude key takeaways and action items.`
      },
      {
        id: 'cs-2',
        title: 'Bullet Points',
        template: `Summarize the key points from "{title}" as bullet points:\n\n{summary}`
      },
      {
        id: 'cs-3',
        title: 'ELI5',
        template: `Explain the following content in simple terms (ELI5):\n\nFrom: {title}\n\n{summary}`
      }
    ]
  },
  {
    id: 'translation',
    icon: '🌐',
    nameKey: 'translation',
    get name() { return t('translation'); },
    prompts: [
      {
        id: 'tr-1',
        title: 'Translate to English',
        template: `Translate the following content to English, maintaining the original tone and meaning:\n\n{summary}`
      },
      {
        id: 'tr-2',
        title: '翻译为中文',
        template: `将以下内容翻译为中文，保持原文的语气和含义：\n\n{summary}`
      },
      {
        id: 'tr-3',
        title: 'Bilingual Comparison',
        template: `Provide a bilingual (English/Chinese) translation of the following:\n\n{summary}\n\nFormat: Original sentence → Translation`
      }
    ]
  },
  {
    id: 'research',
    icon: '🔬',
    nameKey: 'researchAnalysis',
    get name() { return t('researchAnalysis'); },
    prompts: [
      {
        id: 'ra-1',
        title: 'Critical Analysis',
        template: `Provide a critical analysis of the following content from "{title}":\n\n{summary}\n\nConsider:\n1. Strengths and weaknesses of the arguments\n2. Evidence quality\n3. Potential biases\n4. Alternative perspectives`
      },
      {
        id: 'ra-2',
        title: 'Compare & Contrast',
        template: `Based on the context from "{title}":\n\n{summary}\n\nCompare and contrast the key concepts, identifying similarities, differences, and implications.`
      },
      {
        id: 'ra-3',
        title: 'Research Questions',
        template: `Based on this content from "{title}":\n\n{summary}\n\nGenerate 5 research questions that could deepen understanding of this topic.`
      }
    ]
  },
  {
    id: 'writing',
    icon: '✍️',
    get name() { return t('writingAssistant'); },
    prompts: [
      {
        id: 'wa-1',
        title: 'Improve Writing',
        template: `Improve the following text for clarity, conciseness, and impact:\n\n{selection}\n\nMaintain the original meaning while enhancing readability.`
      },
      {
        id: 'wa-2',
        title: 'Generate Outline',
        template: `Based on the following content from "{title}":\n\n{summary}\n\nCreate a detailed outline for a comprehensive article on this topic.`
      }
    ]
  }
];

export function getPromptLibrary() {
  return PROMPT_CATEGORIES;
}

export function findPromptById(id) {
  for (const cat of PROMPT_CATEGORIES) {
    const found = cat.prompts.find(p => p.id === id);
    if (found) return { ...found, category: cat.id };
  }
  return null;
}

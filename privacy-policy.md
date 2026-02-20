# ContextPrompt AI - Privacy Policy

*Last Updated: February 2026*

## Overview

ContextPrompt AI is a browser extension designed to help users capture web context and generate AI prompts. **This extension is committed to protecting your privacy through 100% local data processing.**

---

## Data Collection

### What We Collect
**Nothing.** ContextPrompt AI does not collect, transmit, or store any of your data on external servers.

### What Stays on Your Device
- **Page Context**: Titles, URLs, selected text, and metadata you choose to capture
- **Templates**: Custom prompt templates you create
- **Settings**: Your preferences (theme, language, injection toggle)

---

## Data Processing

All data processing occurs **locally on your device**:

- ✅ Text summarization - runs entirely in your browser
- ✅ Keyword extraction - uses local algorithms
- ✅ Prompt generation - combines your data with templates locally

**No data is ever sent to external servers.**

---

## Data Storage

| Data Type | Storage Location | Retention |
|-----------|------------------|-----------|
| Captured contexts | `chrome.storage.local` | Until you delete them |
| Templates & Settings | `chrome.storage.local` | Until you delete them |
| Prompt History | `chrome.storage.local` | Until you clear history |
| AI API Keys | `chrome.storage.local` | Until you remove them |

---

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `storage` | To save your contexts and settings locally |
| `activeTab` | To capture content from the current page when you click "Capture" |
| `scripting` | To inject the capture script and "Craft Prompt" button into pages |
| `contextMenus` | To provide right-click capture options |
| `sidePanel` | To enable the Chrome side panel interface |
| Host permissions | To inject buttons on specific AI platforms (ChatGPT, Claude, Gemini, Qwen, Doubao) and connect to AI API endpoints |
| Optional host permissions | Requested only when you enable Auto Capture — allows automatic page capture on matching URLs |

---

## Third-Party Services

### Default Mode (No AI)

ContextPrompt AI **does not use any third-party services** by default. There are:

- ❌ No analytics
- ❌ No tracking
- ❌ No external API calls
- ❌ No advertisement networks

### Optional AI Integration

When you **explicitly enable** AI features in Settings and provide your own API key, the extension sends captured page content to the AI API provider **you choose**:

| Provider | Data Sent To | Purpose |
|----------|-------------|---------|
| OpenAI | api.openai.com | Content summarization, prompt quality analysis |
| DeepSeek | api.deepseek.com | Content summarization, prompt quality analysis |
| Anthropic | api.anthropic.com | Content summarization, prompt quality analysis |
| Qwen | dashscope.aliyuncs.com | Content summarization, prompt quality analysis |
| Custom | Your specified endpoint | Content summarization, prompt quality analysis |

**Important:**
- AI features are **disabled by default** and must be explicitly enabled by you
- Your API key is stored **locally** in your browser and is never sent to the extension developer
- Data is sent **only** to the provider you select, using **your own** API key
- The extension developer **never** receives, collects, or has access to any data sent to AI providers
- You can disable AI features at any time to return to fully local processing

---

## Your Rights

You have full control over your data:

1. **View your data**: Open the extension popup to see all saved contexts
2. **Delete individual items**: Click the × button on any context
3. **Delete all data**: Use "Clear All" in the extension popup
4. **Disable features**: Toggle off button injection in Settings

---

## Changes to This Policy

If we update this privacy policy, we will:
- Update the "Last Updated" date at the top
- Notify users through the extension update notes

---

## Contact

For privacy concerns or questions, please visit our GitHub repository:
[GitHub Issues](https://github.com/contextprompt-ai/extension/issues)

---

## Summary

🔒 **Your privacy is guaranteed:**
- All processing happens on your device
- No data leaves your browser
- No accounts or registration required
- Full transparency in how permissions are used

*ContextPrompt AI - Privacy-first AI prompt generation*

# ContextPrompt AI

✨ **Privacy-first AI prompt generation Chrome extension**

Capture web context → Generate precise AI prompts. 100% local processing.

捕获网页上下文 → 生成精准AI提示词。完全本地处理。

## Features

- 📸 **One-click context capture** - Save page title, URL, selected text, and metadata
- ✨ **Intelligent prompt crafting** - Generate context-aware prompts with templates
- 🤖 **Multi-platform support** - Works with ChatGPT, Claude, Gemini, 通义千问, 豆包
- 🔒 **100% local processing** - No data leaves your device
- 🎨 **Modern UI** - Dark/light theme with glassmorphism design

## Supported AI Platforms

| Platform | URL |
|----------|-----|
| ChatGPT | chat.openai.com / chatgpt.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| 通义千问 (Qwen) | chat.qwen.ai |
| 豆包 (Doubao) | www.doubao.com |

## Installation

### Method 1: Load Unpacked (Development)

1. Clone or download this repository
2. Open `assets/icons/generate-icons.html` in your browser
3. Click "Download All Icons" and save the PNGs to `assets/icons/`
4. Open Chrome and navigate to `chrome://extensions`
5. Enable "Developer mode" (top right toggle)
6. Click "Load unpacked" and select the `contextprompt-ai` folder

### Method 2: Chrome Web Store (Coming Soon)

## Usage

1. **Capture Context**: Visit any webpage → Click the extension icon → Click "Capture This Page"
2. **Inject Prompt**: Open any supported AI chat platform → Click the "✨ Craft Prompt" button
3. **Customize**: Use different templates or create your own in Settings

## Project Structure

```
contextprompt-ai/
├── manifest.json              # Extension configuration
├── service-worker.js          # Background message handler
├── content-scripts/
│   ├── capture.js             # Context extraction
│   └── injector.js            # AI page button injection
├── lib/
│   └── nlp-engine.js          # Local NLP processing
├── popup/
│   ├── popup.html             # Main popup UI
│   ├── popup.js               # Popup logic
│   └── popup.css              # Styles
├── assets/
│   ├── icons/                 # Extension icons
│   └── styles.css             # Inject button styles
└── privacy-policy.md          # Privacy documentation
```

## Privacy

- ✅ All processing happens locally in your browser
- ✅ No external network requests
- ✅ Context stored in session storage (cleared on browser close)
- ✅ No analytics, tracking, or data collection

See [privacy-policy.md](privacy-policy.md) for details.

## Development

```bash
# No build required! Pure vanilla JavaScript.
# Just load the extension folder in Chrome developer mode.
```

## License

MIT License - Feel free to use, modify, and distribute.

---

Made with ✨ for the AI-powered productivity community.

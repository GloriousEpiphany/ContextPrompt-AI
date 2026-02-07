# ContextPrompt AI

✨ **智能 AI 提示词生成 Chrome 扩展** | **Smart AI Prompt Generation Chrome Extension**

捕获网页上下文 → 生成精准 AI 提示词。支持 AI 智能摘要。

Capture web context → Generate precise AI prompts. With optional AI-powered summarization.

---

## ✨ Features | 功能特性

### 核心功能
- 📸 **一键捕获上下文** - 保存页面标题、URL、选中文本、元数据和主要内容
- ✨ **智能提示词生成** - 使用模板生成上下文感知的提示词
- 🤖 **多平台支持** - 适配 ChatGPT、Claude、Gemini、通义千问、豆包
- 🔒 **隐私优先** - 本地 NLP 处理，可选 AI 增强

### v2.0 新功能
- 🧠 **AI 智能摘要** - 可选接入 OpenAI、DeepSeek、通义千问等 API
- 📊 **深度内容捕获** - 可配置的捕获深度（轻量/标准/深度）
- 🔗 **私有链接识别** - 自动检测 AI 对话平台的私有链接
- 💬 **对话内容提取** - 提取 AI 平台对话历史用于跨平台引用
- 🎯 **自定义模型** - 支持输入任意模型名称

---

## 🤖 Supported AI Platforms | 支持的 AI 平台

| Platform 平台 | URL 地址 | 私有链接检测 |
|--------------|----------|-------------|
| ChatGPT | chat.openai.com / chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |
| 通义千问 (Qwen) | chat.qwen.ai | ✅ |
| 豆包 (Doubao) | www.doubao.com | ✅ |

---

## 🚀 Installation | 安装

### 开发者模式加载

1. 下载或克隆本仓库
2. 打开 `assets/icons/generate-icons.html` 生成图标（首次安装）
3. 访问 `chrome://extensions`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」选择 `contextprompt-ai` 文件夹

---

## 📖 Usage | 使用方法

### 基础用法

1. **捕获上下文**: 访问任意网页 → 点击扩展图标 → 点击 "Capture This Page"
2. **生成提示词**: 打开支持的 AI 平台 → 点击 "✨ Craft Prompt" 按钮
3. **自定义模板**: 在设置中选择不同的提示词模板

### AI 智能摘要（可选）

1. 打开扩展设置 → AI 集成
2. 启用 "AI Summarization"
3. 选择 API 提供商（OpenAI / DeepSeek / 通义千问）
4. 输入 API Key
5. 可选：自定义 Base URL 和模型名称

### 捕获深度设置

| 模式 | 消息长度 | 消息数量 | 页面内容 | 适用场景 |
|------|---------|---------|---------|---------|
| 💨 轻量 | 500字符/条 | 10条 | 3000字符 | 节省 Token |
| ⚖️ 标准 | 1500字符/条 | 20条 | 8000字符 | 日常使用 |
| 🔬 深度 | 3000字符/条 | 30条 | 15000字符 | 完整内容 |

---

## 🗂️ Project Structure | 项目结构

```
contextprompt-ai/
├── manifest.json              # 扩展配置
├── service-worker.js          # 后台服务 & AI API 调用
├── content-scripts/
│   ├── capture.js             # 深度内容提取
│   └── injector.js            # AI 平台按钮注入
├── lib/
│   ├── nlp-engine.js          # 本地 NLP 处理
│   └── ai-service.js          # AI API 服务封装
├── popup/
│   ├── popup.html             # 弹窗 UI
│   ├── popup.js               # 弹窗逻辑
│   └── popup.css              # 样式
├── assets/
│   ├── icons/                 # 扩展图标
│   └── styles.css             # 注入按钮样式
└── privacy-policy.md          # 隐私政策
```

---

## 🔒 Privacy | 隐私保护

### 本地模式（默认）
- ✅ 所有处理在浏览器本地完成
- ✅ 无外部网络请求
- ✅ 上下文存储在会话存储中（关闭浏览器自动清除）
- ✅ 无分析、追踪或数据收集

### AI 增强模式（可选）
- 🔐 仅在启用 AI 摘要时发送内容到 AI API
- 🔐 API Key 安全存储在本地
- 🔐 可随时关闭 AI 功能回到纯本地模式

详见 [privacy-policy.md](privacy-policy.md)

---

## ⚙️ Configuration | 配置说明

### AI API 配置

| 提供商 | Base URL | 推荐模型 |
|-------|----------|---------|
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat |
| 通义千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-turbo |

---

## 🛠️ Development | 开发

```bash
# 无需构建！纯原生 JavaScript
# 直接在 Chrome 开发者模式加载扩展文件夹即可
```

---

## 📄 License

MIT License - 自由使用、修改和分发。

---

Made with ✨ for the AI-powered productivity community.

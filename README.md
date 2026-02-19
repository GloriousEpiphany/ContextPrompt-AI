# ContextPrompt AI

✨ **智能 AI 提示词生成 Chrome 扩展** — 捕获网页上下文，生成精准 AI 提示词，支持 AI 智能摘要、提示词质量分析、Side Panel 全功能面板。

---

## ✨ 功能特性

### 核心功能
- 📸 **一键捕获上下文** — 保存页面标题、URL、选中文本、元数据和主要内容
- ✨ **智能提示词生成** — 使用模板生成上下文感知的提示词，支持预览和编辑
- 🤖 **多平台支持** — 适配 ChatGPT、Claude、Gemini、通义千问、豆包
- 🔒 **隐私优先** — 本地 NLP 处理，可选 AI 增强
- 🌐 **国际化** — 完整的中英文双语支持（i18n）

### v3.0 新功能
- 🧠 **AI 智能摘要** — 可选接入 OpenAI、DeepSeek、Anthropic、通义千问等 API，捕获后自动摘要
- 📊 **提示词质量雷达图** — Canvas 2D 绘制，分析清晰度、具体性、完整性、总分
- 📚 **提示词库** — 预置代码审查、内容摘要、翻译、研究分析、写作助手 5 大分类
- 🏷️ **标签系统** — 手动添加标签 + NLP 自动标签建议
- 🔍 **搜索过滤** — 300ms 防抖，按标题、URL、内容、标签匹配
- ✏️ **上下文编辑** — 编辑标题、备注、标签
- 📋 **模板编辑器** — 自定义模板 CRUD，支持占位符参考
- 📤 **导出/导入** — JSON 格式导出导入，合并去重
- 📜 **提示词历史** — 最多 100 条历史记录，支持收藏
- ⭐ **提示词收藏** — 快速访问收藏的提示词
- 🖥️ **Side Panel** — 完整功能侧边栏（上下文管理、提示词库、历史、质量分析）
- 👁️ **提示词预览面板** — 浮动预览、编辑、模板切换、确认插入
- ⌨️ **键盘快捷键** — `Ctrl+Shift+C` 捕获页面，`Ctrl+Shift+P` 生成提示词
- 🖱️ **右键菜单** — 捕获页面、捕获选中文本、捕获链接
- 📡 **自动捕获** — 监听页面加载，按 URL 模式自动捕获
- 🔢 **Badge 计数** — 扩展图标显示已保存上下文数量
- 💾 **持久化存储** — 上下文存储在 local storage，关闭浏览器不丢失
- 🎨 **艺术级 UI** — 设计系统、毛玻璃效果、流畅动画、骨架屏、SVG 空状态插图
- ♿ **无障碍** — ARIA 标签、键盘焦点管理、prefers-reduced-motion 支持
- 🎓 **新用户引导** — 3 步引导流程

---

## 🤖 支持的 AI 平台

| 平台 | 地址 | 私有链接检测 |
|------|------|:----------:|
| ChatGPT | chat.openai.com / chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |
| 通义千问 | chat.qwen.ai | ✅ |
| 豆包 | www.doubao.com | ✅ |

---

## 🚀 安装

### 开发者模式加载

1. 下载或克隆本仓库
2. 打开 `assets/icons/generate-icons.html` 生成图标（首次安装）
3. 访问 `chrome://extensions`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」选择 `contextprompt-ai` 文件夹

---

## 📖 使用方法

### 基础用法

1. **捕获上下文**: 访问任意网页 → 点击扩展图标 → 点击「捕获当前页面」
2. **生成提示词**: 打开支持的 AI 平台 → 点击「✨ Craft Prompt」按钮 → 预览/编辑 → 插入
3. **自定义模板**: 点击模板编辑按钮，创建自定义提示词模板

### 快捷操作

| 操作 | 方式 |
|------|------|
| 捕获当前页面 | `Ctrl+Shift+C` / 右键菜单 / 扩展弹窗 |
| 生成并插入提示词 | `Ctrl+Shift+P` / 页面内按钮 |
| 捕获选中文本 | 右键菜单 → 「捕获选中文本」 |
| 捕获链接 | 右键菜单 → 「捕获链接」 |
| 搜索上下文 | 弹窗搜索框 / Side Panel 搜索 |
| 多选融合 | `Ctrl+点击` 选择多个上下文 → 点击「融合」 |

### AI 智能摘要（可选）

1. 打开扩展设置 → AI 集成
2. 启用「AI 智能摘要」
3. 选择 API 提供商（OpenAI / DeepSeek / Anthropic / 通义千问 / 自定义）
4. 输入 API Key
5. 可选：自定义 Base URL 和模型名称

### 捕获深度设置

| 模式 | 聊天消息长度 | 聊天消息数量 | 页面内容上限 | 适用场景 |
|------|---------|---------|---------|---------|
| 💨 轻量 | 500 字符/条 | 10 条 | 15,000 字符 | 节省 Token |
| ⚖️ 标准 | 1,500 字符/条 | 20 条 | 50,000 字符 | 日常使用 |
| 🔬 深度 | 3,000 字符/条 | 30 条 | 150,000 字符 | 完整内容 |

### Side Panel

在 Chrome 工具栏点击扩展图标旁的侧边栏按钮，打开 Side Panel：
- **Contexts** — 浏览、搜索、管理所有已保存的上下文
- **Library** — 浏览预置提示词库，点击即可复制
- **History** — 查看提示词生成历史，支持收藏
- **Quality** — 粘贴提示词，AI 分析质量并生成雷达图

---

## 🗂️ 项目结构

```
contextprompt-ai/
├── manifest.json                 # 扩展配置（v3, i18n, 权限, 快捷键, Side Panel）
├── service-worker.js             # 后台服务（消息中枢, AI API, 上下文管理, 历史, 标签）
├── _locales/
│   ├── en/messages.json          # 英文语言包
│   └── zh/messages.json          # 中文语言包
├── content-scripts/
│   ├── capture.js                # Readability 算法深度内容提取
│   └── injector.js               # AI 平台按钮注入 + 预览面板
├── lib/
│   ├── ai-service.js             # AI API 服务封装（OpenAI/DeepSeek/Anthropic/Qwen/自定义）
│   ├── nlp-engine.js             # 本地 NLP 处理（摘要, 关键词, 语言检测）
│   ├── prompt-library.js         # 预置提示词库（5 大分类）
│   └── i18n-helper.js            # 国际化辅助工具
├── popup/
│   ├── popup.html                # 弹窗 UI（搜索, 编辑, 导出, 模板, 历史）
│   ├── popup.js                  # 弹窗逻辑
│   └── popup.css                 # 弹窗样式（设计系统, 动画, 毛玻璃）
├── sidepanel/
│   ├── sidepanel.html            # Side Panel UI
│   ├── sidepanel.js              # Side Panel 逻辑（雷达图, 提示词库, 历史）
│   └── sidepanel.css             # Side Panel 样式
├── onboarding/
│   ├── onboarding.html           # 新用户引导页
│   ├── onboarding.js             # 引导逻辑
│   └── onboarding.css            # 引导样式
├── assets/
│   ├── design-tokens.css         # 设计系统（颜色, 间距, 圆角, 阴影, 动画, 骨架屏）
│   ├── styles.css                # 注入按钮 + 预览面板样式
│   ├── icons/                    # 扩展图标
│   └── illustrations/            # SVG 空状态插图
└── privacy-policy.md             # 隐私政策
```

---

## 🔒 隐私保护

### 本地模式（默认）
- ✅ 所有处理在浏览器本地完成
- ✅ 无外部网络请求
- ✅ 上下文持久化存储在 `chrome.storage.local`
- ✅ 无分析、追踪或数据收集

### AI 增强模式（可选）
- 🔐 仅在启用 AI 摘要时发送内容到 AI API
- 🔐 API Key 安全存储在本地
- 🔐 可随时关闭 AI 功能回到纯本地模式

详见 [privacy-policy.md](privacy-policy.md)

---

## ⚙️ 配置说明

### AI API 配置

| 提供商 | Base URL | 推荐模型 |
|-------|----------|---------|
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat |
| Anthropic | https://api.anthropic.com/v1 | claude-3-haiku-20240307 |
| 通义千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-turbo |
| 自定义 | 用户自定义 | 用户自定义 |

### 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 持久化存储上下文、设置、模板、历史 |
| `activeTab` | 捕获当前标签页内容 |
| `scripting` | 注入内容脚本到页面 |
| `contextMenus` | 右键菜单（捕获页面/选中文本/链接） |
| `sidePanel` | Side Panel 侧边栏功能 |

---

## 🛠️ 开发

```bash
# 无需构建！纯原生 JavaScript + ES Modules
# 直接在 Chrome 开发者模式加载扩展文件夹即可
```

### 技术栈
- Chrome Extension Manifest V3
- ES Modules（service-worker, popup, sidepanel）
- Canvas 2D（雷达图）
- CSS Custom Properties（设计系统）
- `backdrop-filter`（毛玻璃效果）
- `chrome.storage.local`（持久化存储）

---

## 📄 License

MIT License — 自由使用、修改和分发。

---

Made with ✨ by ContextPrompt AI

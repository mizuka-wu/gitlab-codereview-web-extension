# GitLab 代码审查助手（浏览器扩展）

[English](README.md)

一个用于 GitLab Merge Request 的 Chrome 浏览器扩展，基于多种 AI 模型辅助进行代码审查。它支持本地 LLM（通过 Ollama）、OpenAI API 和 Claude API。扩展可检测 GitLab 页面、获取 MR diff、生成审查建议，并在 MR 页面中自动发表行内评论。

## 功能

- GitLab 页面检测与扩展图标状态更新（`src/background.ts`、`src/content/index.ts`）。
- 选项页（支持中英双语）、AI 代理与提示词配置（`src/pages/Options.vue`、`src/i18n/*`）。
- 多种 AI 代理支持：
  - **Ollama**：本地 LLM 集成，支持模型拉取与可用性检测
  - **OpenAI API**：云端 AI 服务，支持 GPT 系列模型
  - **Claude API**：Anthropic 的 AI 服务，支持 Claude 系列模型
- 采用流式生成以降低超时风险
- 弹窗工作流：发起分析与展示进度（`src/pages/Popup.vue`、`src/pages/popup/Task.vue`）。
- 通过内容脚本代理向 MR 提交评论（`src/task/gitlab-proxy.ts`）。

## 快速开始

- 环境要求
  - Node.js 18+
  - pnpm
  - Google Chrome

- 安装依赖
  ```bash
  pnpm i
  ```

- 开发调试（自动启动带持久化配置的 Chrome）
  ```bash
  pnpm dev
  ```
  开发浏览器由 `vite-plugin-web-extension` 启动，使用项目根目录下的 `.webext-profile` 作为用户数据目录，保证登录状态不会丢失。若本机 Chrome 路径不同，可在 `vite.config.ts` 的 `webExtConfig.chromiumBinary` 中调整。

- 构建打包
  ```bash
  pnpm build
  ```
  构建完成后，在 Chrome 的扩展管理页（chrome://extensions）选择"加载已解压的扩展程序"，指定 `dist/` 目录。

## 配置与使用

### AI 代理配置

1. 打开 Options（可在扩展详情或弹窗中进入）。
2. 在"AI 代理设置"：
   - 选择代理：Ollama、OpenAI 或 Claude
   - 配置选中的代理：

#### Ollama（本地）
   - 配置 Endpoint（默认为 `http://localhost:11434`）
   - 点击"刷新"拉取模型列表，选择一个模型，并可"测试连接"

#### OpenAI API
   - 输入你的 OpenAI API Key
   - 可选择自定义基础 URL（默认：`https://api.openai.com`）
   - 选择模型（推荐：`gpt-3.5-turbo` 或 `gpt-4o`）
   - 设置超时时间（默认：60000ms）

#### Claude API
   - 输入你的 Claude API Key
   - 可选择自定义基础 URL（默认：`https://api.anthropic.com`）
   - 选择模型（推荐：`claude-3-haiku-20240307`）
   - 设置超时时间（默认：60000ms）

3. 可在"提示词设置"中编辑模板（默认模板见 `src/constants/index.ts` → `DEFAUTL_PROMPT`）。
4. 在"语言设置"选择 UI 语言（中文/英文）。
5. 打开任一 GitLab Merge Request 页面，打开扩展弹窗点击"开始分析"。

### AI 代理选择建议

- **Ollama**：适合开发环境，免费，注重隐私
- **OpenAI**：适合生产环境，质量高，稳定可靠
- **Claude**：适合代码审查任务，代码理解能力强

详细 API 使用说明请参考 [API_USAGE.md](API_USAGE.md)。

## 权限说明

- 基础权限：`activeTab`、`storage`、`tabs`
- Host 权限（Chrome）：
  - `http://localhost:11434/*`（Ollama）
  - `http://127.0.0.1:11434/*`（Ollama）
  - `https://api.openai.com/*`（OpenAI API）
  - `https://api.anthropic.com/*`（Claude API）
- 可选 Host 权限：`http://*/*`、`https://*/*`（当你在 Options 中填写自定义 Endpoint 时，会在运行时发起请求）
- 参见 `src/manifest.json` 与 `src/pages/Options.vue` 中的实现。

## 目录结构

```
src/
  background.ts                     # MV3 Service Worker（Chrome）
  content/
    index.ts                        # 内容脚本入口：页面检测 + API 代理
    gitlab-api-proxy.ts             # （内容侧）GitLab API 代理
    gitlab-detector.ts              # GitLab 页面检测
  i18n/
    index.ts                        # Vue I18n 初始化（zh-CN / en-US）
  pages/
    Options.vue                     # 选项页（Naive UI + i18n）
    Popup.vue                       # 弹窗容器
    popup/Task.vue                  # 任务流程与 UI
  task/
    agent/
      ollama.ts                     # Ollama 客户端（生成/拉取/检测）
      api-client.ts                 # OpenAI & Claude API 客户端
      index.ts                      # generateReview() 调度
    gitlab-proxy.ts                 # 通过内容脚本提交评论
  options.ts                        # 选项页入口（挂载 Options.vue）
  popup.ts                          # 弹窗入口（挂载 Popup.vue）
  manifest.json                     # 扩展清单（模板化）
constants/index.ts                  # 默认配置（端点、模型、提示词等）
```

## 技术栈

- Vue 3 + TypeScript
- Naive UI
- Vue I18n（`vue-i18n` + `@intlify/unplugin-vue-i18n`）
- Vite 5 + `vite-plugin-web-extension`
- `webextension-polyfill`

## 常见问题（FAQ）

- Chrome 未能启动或路径错误：请在 `vite.config.ts` 中调整 `chromiumBinary`。
- 模型列表为空/连接测试失败（Ollama）：确认本地 Ollama 正在运行（`ollama serve`），并在浏览器弹出的权限请求中选择"允许"。
- API 请求失败：检查 API Key 有效性、网络连接和服务状态。
- 无法发表评论：确认已在开发用浏览器中登录 GitLab；配置文件位于 `.webext-profile`。
- 在非 MR 页使用无效：该功能仅针对 GitLab 的 Merge Request 页面。

## 安全与隐私

- **Ollama**：所有数据都在本地，完全私密
- **OpenAI/Claude**：数据会发送到云端服务，请查看其隐私政策
- API Key 存储在浏览器存储中，请保护你的浏览器配置文件
- 对于敏感代码审查任务，建议使用本地服务

## 更新日志

- **v1.1.0**: 新增多种AI代理支持
  - 新增 OpenAI API 支持
  - 新增 Claude API 支持  
  - 新增 OpenAPI 兼容服务支持
  - 新增高级配置选项（自定义headers、参数、认证等）
  - 改进的国际化支持
  - 优化的AI代理架构
- **v1.0.0**: 初始版本，仅支持 Ollama

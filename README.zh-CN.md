# GitLab 代码审查助手（浏览器扩展）

[English](README.md)

一个用于 GitLab Merge Request 的 Chrome 浏览器扩展，基于本地 LLM（通过 Ollama）辅助进行代码审查。它可检测 GitLab 页面、获取 MR diff、生成审查建议，并在 MR 页面中自动发表行内评论。

## 功能

- GitLab 页面检测与扩展图标状态更新（`src/background.ts`、`src/content/index.ts`）。
- 选项页（支持中英双语）、AI 代理与提示词配置（`src/pages/Options.vue`、`src/i18n/*`）。
- Ollama 集成：
  - 拉取本地模型列表与可用性检测（`src/task/agent/ollama.ts`）。
  - 采用流式生成以降低超时风险（`generateWithOllama`）。
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
  构建完成后，在 Chrome 的扩展管理页（chrome://extensions）选择“加载已解压的扩展程序”，指定 `dist/` 目录。

## 配置与使用

1. 打开 Options（可在扩展详情或弹窗中进入）。
2. 在“AI 代理设置”：
   - 选择代理：Ollama
   - 配置 Endpoint（默认为 `http://localhost:11434`）
   - 点击“刷新”拉取模型列表，选择一个模型，并可“测试连接”
3. 可在“提示词设置”中编辑模板（默认模板见 `src/constants/index.ts` → `DEFAUTL_PROMPT`）。
4. 在“语言设置”选择 UI 语言（中文/英文）。
5. 打开任一 GitLab Merge Request 页面，打开扩展弹窗点击“开始分析”。开始前会做模型可用性预检。

## 权限说明

- 基础权限：`activeTab`、`storage`、`tabs`
- Host 权限（Chrome）：
  - `http://localhost:11434/*`
  - `http://127.0.0.1:11434/*`
- 可选 Host 权限：`http://*/*`、`https://*/*`（当你在 Options 中填写自定义 Endpoint 时，会在运行时发起请求）
- 参见 `src/manifest.json` 与 `src/pages/Options.vue` 中的 `ensureHostPermissionForEndpoint` 实现。

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
      index.ts                      # generateReview() 调度
    gitlab-proxy.ts                 # 通过内容脚本提交评论
  options.ts                        # 选项页入口（挂载 Options.vue）
  popup.ts                          # 弹窗入口（挂载 Popup.vue）
  manifest.json                     # 扩展清单（模板化）
constants/index.ts                  # 默认配置（Endpoint、Prompt 等）
```

## 技术栈

- Vue 3 + TypeScript
- Naive UI
- Vue I18n（`vue-i18n` + `@intlify/unplugin-vue-i18n`）
- Vite 5 + `vite-plugin-web-extension`
- `webextension-polyfill`

## 常见问题（FAQ）

- Chrome 未能启动或路径错误：请在 `vite.config.ts` 中调整 `chromiumBinary`。
- 模型列表为空/连接测试失败：确认本地 Ollama 正在运行（`ollama serve`），并在浏览器弹出的权限请求中选择“允许”。
- 无法发表评论：确认已在开发用浏览器中登录 GitLab；配置文件位于 `.webext-profile`。
- 在非 MR 页使用无效：该功能仅针对 GitLab 的 Merge Request 页面。

## 备注

- 默认语言为 `zh-CN`，回退为 `en-US`（`src/i18n/index.ts`）。
- 弹窗任务在分析前会做模型可用性预检（`src/pages/popup/Task.vue`）。

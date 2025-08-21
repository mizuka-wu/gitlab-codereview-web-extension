# GitLab Code Review Assistant (Browser Extension)

[中文说明](README.zh-CN.md)

A Chrome browser extension that assists code review on GitLab Merge Requests using AI models. It supports local LLMs via Ollama, OpenAI API, and Claude API. The extension detects GitLab pages, fetches MR diffs, generates review suggestions, and posts inline comments automatically.

## 更新日志

- **v1.1.0**: 新增多种AI代理支持
  - 新增 OpenAI API 支持
  - 新增 Claude API 支持  
  - 新增 OpenAPI 兼容服务支持
  - 新增高级配置选项（自定义headers、参数、认证等）
  - 改进的国际化支持
  - 优化的AI代理架构
- **v1.0.0**: 初始版本，仅支持 Ollama

## Features

- GitLab page detection and action icon state updates (`src/background.ts`, `src/content/index.ts`).
- Options page with i18n (English/Chinese), agent config, and prompt template (`src/pages/Options.vue`, `src/i18n/*`).
- Multiple AI Agent support:
  - **Ollama**: Local LLM integration with model fetching and availability testing
  - **OpenAI API**: Cloud-based AI service with GPT models
  - **Claude API**: Anthropic's AI service with Claude models
  - **OpenAPI Compatible**: Custom deployed AI services with automatic format detection
- Streamed generation to reduce timeouts
- Popup workflow to run analysis and show progress (`src/pages/Popup.vue`, `src/pages/popup/Task.vue`).
- Posts review comments back to MR via content-script proxy (`src/task/gitlab-proxy.ts`).

## Getting Started

- Requirements
  - Node.js 18+ (Vite 5)
  - pnpm
  - Google Chrome

- Install
  ```bash
  pnpm i
  ```

- Development (auto-launches Chromium with a persistent profile)
  ```bash
  pnpm dev
  ```
  The dev browser is started by `vite-plugin-web-extension` using the profile at `.webext-profile`. Adjust Chrome binary path in `vite.config.ts` (`webExtConfig.chromiumBinary`) if needed.

- Build
  ```bash
  pnpm build
  ```
  Then load the generated `dist/` as an unpacked extension in Chrome (chrome://extensions → Load unpacked).

## Configure & Use

### AI Agent Configuration

1. Open the Options page (from the popup or extension details).
2. In "AI Agent Settings":
   - Select agent: Ollama, OpenAI, or Claude
   - Configure the selected agent:

#### Ollama (Local)
   - Set endpoint (default: `http://localhost:11434`)
   - Click "Refresh" to fetch local models, pick one, and "Test Connection"

#### OpenAI API
   - Enter your OpenAI API Key
   - Optionally customize base URL (default: `https://api.openai.com`)
   - Select model (recommended: `gpt-3.5-turbo` or `gpt-4o`)
   - Set timeout (default: 60000ms)

#### Claude API
   - Enter your Claude API Key
   - Optionally customize base URL (default: `https://api.anthropic.com`)
   - Select model (recommended: `claude-3-haiku-20240307`)
   - Set timeout (default: 60000ms)

#### OpenAPI Compatible Service
   - Enter your API Key (optional, depending on service)
   - Enter service URL (e.g., `http://localhost:8000`)
   - Enter model name (e.g., `llama2`, `mistral`)
   - Set timeout (default: 60000ms)
   - **Advanced Settings**: Customize headers, request parameters, authentication, and more

3. Optionally edit the prompt template (default in `src/constants/index.ts` → `DEFAUTL_PROMPT`).
4. Choose UI language in "Language Settings".
5. Go to a GitLab Merge Request page, open the popup, and click "Start Analysis".

### AI Agent Selection Guide

- **Ollama**: Best for development environments, free, privacy-focused
- **OpenAI**: Best for production use, high quality, reliable
- **Claude**: Best for code review tasks, excellent code understanding
- **OpenAPI Compatible**: Best for custom deployments, open source models, full control

For detailed API usage instructions, see [API_USAGE.md](API_USAGE.md).

## Permissions

- Basic: `activeTab`, `storage`, `tabs`
- Host permissions (Chrome):
  - `http://localhost:11434/*` (Ollama)
  - `http://127.0.0.1:11434/*` (Ollama)
  - `https://api.openai.com/*` (OpenAI API)
  - `https://api.anthropic.com/*` (Claude API)
  - `http://*/*`, `https://*/*` (OpenAPI compatible services)
- Optional host permissions: `http://*/*`, `https://*/*` (requested at runtime for custom endpoints)
- See `src/manifest.json` and the runtime request logic in `src/pages/Options.vue`.

## Project Structure

```
src/
  background.ts                     # MV3 service worker (Chrome)
  content/                          # Content script entry and helpers
    index.ts                        # Detector + API proxy entry
    gitlab-api-proxy.ts             # (content-side) GitLab API proxy
    gitlab-detector.ts              # GitLab page detection
  i18n/                             # Vue I18n (zh-CN / en-US)
    index.ts                        # i18n setup
  pages/
    Options.vue                     # Options UI (Naive UI + i18n)
    Popup.vue                       # Popup UI container
    popup/Task.vue                  # Task runner UI & flow
  task/
    agent/
      ollama.ts                     # Ollama client (generate / list / check)
      api-client.ts                 # OpenAI, Claude & OpenAPI compatible clients
      index.ts                      # generateReview() orchestrator
    gitlab-proxy.ts                 # Comment posting via content script
  options.ts                        # Options entry (mounts Options.vue)
  popup.ts                          # Popup entry (mounts Popup.vue)
  manifest.json                     # WebExtension manifest (templated)
constants/index.ts                  # Defaults (endpoints, models, prompt, etc.)
```

## Tech Stack

- Vue 3 + TypeScript
- Naive UI
- Vue I18n (`vue-i18n` + `@intlify/unplugin-vue-i18n`)
- Vite 5 + `vite-plugin-web-extension`
- `webextension-polyfill`

## Troubleshooting

- Chrome not launching or wrong path: update `chromiumBinary` in `vite.config.ts`.
- Model list empty / test fails (Ollama): ensure Ollama is running (`ollama serve`) and grant host permission when prompted.
- API requests failing: check API key validity, network connectivity, and service status.
- OpenAPI service connection issues: verify service URL, check if service is running, review firewall settings.
- Comments not posted: make sure you are logged into GitLab in the dev browser. The profile is persisted at `.webext-profile`.
- Not working on non-MR pages: this feature is designed for GitLab Merge Request pages only.

## Security & Privacy

- **Ollama**: All data stays local, completely private
- **OpenAI/Claude**: Data is sent to cloud services, review their privacy policies
- **OpenAPI Compatible**: Depends on deployment location, self-hosted is completely private
- API keys are stored in browser storage, protect your browser profile
- Consider using local services for sensitive code review tasks

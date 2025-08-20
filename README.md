# GitLab Code Review Assistant (Browser Extension)

[中文说明](README.zh-CN.md)

A Chrome browser extension that assists code review on GitLab Merge Requests using a local LLM via Ollama. It detects GitLab pages, fetches MR diffs, generates review suggestions, and posts inline comments automatically.

## Features

- GitLab page detection and action icon state updates (`src/background.ts`, `src/content/index.ts`).
- Options page with i18n (English/Chinese), agent config, and prompt template (`src/pages/Options.vue`, `src/i18n/*`).
- Ollama integration:
  - Fetch local models and test availability (`src/task/agent/ollama.ts`).
  - Streamed generation to reduce timeouts (`generateWithOllama`).
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

1. Open the Options page (from the popup or extension details).
2. In "AI Agent Settings":
   - Select agent: Ollama
   - Set endpoint (default: `http://localhost:11434`)
   - Click "Refresh" to fetch local models, pick one, and "Test Connection"
3. Optionally edit the prompt template (default in `src/constants/index.ts` → `DEFAUTL_PROMPT`).
4. Choose UI language in "Language Settings".
5. Go to a GitLab Merge Request page, open the popup, and click "Start Analysis". The precheck ensures the selected model is available before running.

## Permissions

- Basic: `activeTab`, `storage`, `tabs`
- Host permissions (Chrome):
  - `http://localhost:11434/*`
  - `http://127.0.0.1:11434/*`
- Optional host permissions: `http://*/*`, `https://*/*` (requested at runtime when you set a custom endpoint in Options)
- See `src/manifest.json` and the runtime request logic in `src/pages/Options.vue` (`ensureHostPermissionForEndpoint`).

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
      index.ts                      # generateReview() orchestrator
    gitlab-proxy.ts                 # Comment posting via content script
  options.ts                        # Options entry (mounts Options.vue)
  popup.ts                          # Popup entry (mounts Popup.vue)
  manifest.json                     # WebExtension manifest (templated)
constants/index.ts                  # Defaults (endpoint, prompt, etc.)
```

## Tech Stack

- Vue 3 + TypeScript
- Naive UI
- Vue I18n (`vue-i18n` + `@intlify/unplugin-vue-i18n`)
- Vite 5 + `vite-plugin-web-extension`
- `webextension-polyfill`

## Troubleshooting

- Chrome not launching or wrong path: update `chromiumBinary` in `vite.config.ts`.
- Model list empty / test fails: ensure Ollama is running (`ollama serve`) and grant host permission when prompted.
- Comments not posted: make sure you are logged into GitLab in the dev browser. The profile is persisted at `.webext-profile`.
- Not working on non-MR pages: this feature is designed for GitLab Merge Request pages only.

## Notes

- Default locale is `zh-CN` with fallback `en-US` (`src/i18n/index.ts`).
- Popup task performs a model precheck before analyzing diffs (`src/pages/popup/Task.vue`).

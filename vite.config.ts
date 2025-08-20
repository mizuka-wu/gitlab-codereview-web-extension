import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import path from "node:path";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";

const INVALID_CHAR_REGEX = /[\x00-\x1F\x7F<>*#"{}|^[\]`;?:&=+$,]/g;
const DRIVE_LETTER_REGEX = /^[a-z]:/i;

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  const pkg = readJsonFile("package.json");
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __VUE_I18N_PROD_DEVTOOLS__: false,
    __VUE_I18N_JIT_COMPILATION__: false,
  },
  build: {
    rollupOptions: {
      output: {
        sanitizeFileName(name) {
          const match = DRIVE_LETTER_REGEX.exec(name);
          const driveLetter = match ? match[0] : "";
          // substr 是被淘汰語法，因此要改 slice
          return (
            driveLetter +
            name.slice(driveLetter.length).replace(INVALID_CHAR_REGEX, "")
          );
        },
      },
    },
  },
  plugins: [
    vue(),
    VueI18nPlugin({
      // 不使用 JIT，避免 eval
      jitCompilation: false,
      // 仅预编译 JSON 语言包，避免匹配到 src/i18n/index.ts 导致错误
      include: [
        path.resolve(process.cwd(), "src/i18n/**/*.json"),
      ],
    }),
    webExtension({
      // 仅保留 Chrome 相关清单片段
      browser: "chrome",
      manifest: generateManifest,
      watchFilePaths: ["package.json", "src/manifest.json"],
      // 固定开发浏览器用户数据目录，避免每次重启丢失 Cookie
      webExtConfig: {
        target: "chromium",
        chromiumProfile: path.resolve(process.cwd(), ".webext-profile"),
        startUrl: ["https://jihulab.com/"],
        // 明确指定 Chrome 可执行文件（macOS 常见路径）
        chromiumBinary:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        // 再通过 args 显式传递 user-data-dir，双保险
        args: [
          `--user-data-dir=${path.resolve(process.cwd(), ".webext-profile")}`,
          "--no-first-run",
          "--no-default-browser-check",
        ],
        // 如需指定浏览器可执行文件（可选）：
        // chromiumBinary: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      },
    }),
  ],
});

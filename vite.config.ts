import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import path from "node:path";

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
  plugins: [
    vue(),
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
        chromiumBinary: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
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

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
      manifest: generateManifest,
      watchFilePaths: ["package.json", "manifest.json"],
      // 固定开发浏览器用户数据目录，避免每次重启丢失 Cookie
      webExtConfig: {
        target: "chromium",
        chromiumProfile: path.resolve(process.cwd(), ".webext-profile"),
        // 如需指定浏览器可执行文件（可选）：
        // chromiumBinary: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      },
    }),
  ],
});

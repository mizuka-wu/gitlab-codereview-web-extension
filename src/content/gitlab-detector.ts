import browser from "webextension-polyfill";
import { type DetectorSettings as Settings } from "../types/index.d";

/**
 * GitLab检测器
 * 用于检测当前页面是否是GitLab或基于GitLab部署的网页
 * 并提取合并请求相关信息
 */

// GitLab特征检测点
const GITLAB_FEATURES = {
  // GitLab页面特有的元素
  ELEMENTS: [
    "header.navbar-gitlab", // GitLab导航栏
    ".gitlab-header-content", // GitLab头部内容
    ".js-gitlab-header", // GitLab头部JS类
    ".layout-page.page-with-sidebar", // GitLab页面布局
    ".navbar-gitlab", // GitLab导航栏
    ".gitlab-app", // GitLab应用容器
    ".gl-button", // GitLab按钮样式
    ".js-projects-list-holder", // 项目列表容器
    ".project-home-panel", // 项目主页面板
    ".merge-request", // 合并请求元素
    ".issue-details", // 问题详情
    ".file-holder", // 文件容器
    ".diff-file", // 差异文件
    ".js-main-loader", // GitLab加载器
    ".nav-sidebar", // GitLab侧边栏
    ".top-bar-fixed", // GitLab顶部固定栏
    ".gl-pagination", // GitLab分页
  ],

  // GitLab页面特有的meta标签
  META_TAGS: [
    { name: "application-name", content: "GitLab" },
    { property: "og:site_name", content: "GitLab" },
    { name: "description", content: /GitLab/i },
    { property: "og:description", content: /GitLab/i },
    { name: "twitter:site", content: "@gitlab" },
    { name: "viewport", content: /GitLab/i },
    { name: "csrf-param", content: "authenticity_token" }, // GitLab使用Rails，这是Rails的CSRF标记
  ],

  // GitLab API端点
  API_ENDPOINTS: ["/api/v4/"],

  // GitLab相关的URL模式
  URL_PATTERNS: [
    /gitlab\.com/, // GitLab官方
    /jihulab\.com/, // 极狐GitLab
    /gitcode\.net/, // GitCode
    /\/gitlab\//, // 自部署GitLab路径
    /gitlab/i, // URL中包含gitlab字样
  ],
};

// 默认设置
const defaultSettings: Settings = {
  isEnable: true,
};

// 当前设置
let currentSettings: Settings = { ...defaultSettings };

// 加载设置
async function loadSettings(): Promise<Settings> {
  try {
    const data = await browser.storage.local.get("settings");
    return data.settings?.detctor || { ...defaultSettings };
  } catch (error) {
    console.error("加载设置时出错:", error);
    return { ...defaultSettings };
  }
}

/**
 * 检测当前页面是否是GitLab
 * @returns {boolean} 是否是GitLab页面
 */
async function detectGitLab(): Promise<boolean> {
  // 加载设置
  currentSettings = await loadSettings();

  // 如果扩展被禁用，直接返回false
  if (!currentSettings.isEnable) {
    return false;
  }

  let score = 0;

  // 检查URL
  const currentUrl = window.location.href;
  if (
    GITLAB_FEATURES.URL_PATTERNS.some((pattern) => pattern.test(currentUrl))
  ) {
    score += 3; // URL匹配给予较高的分数
  }

  // 检查DOM元素
  GITLAB_FEATURES.ELEMENTS.forEach((selector) => {
    if (document.querySelector(selector)) {
      score += 2;
    }
  });

  // 检查meta标签
  GITLAB_FEATURES.META_TAGS.forEach((meta) => {
    const selector = meta.name
      ? `meta[name="${meta.name}"]`
      : `meta[property="${meta.property}"]`;

    const metaElement = document.querySelector(selector);
    if (metaElement) {
      const content = metaElement.getAttribute("content");

      if (content) {
        // 如果meta.content是正则表达式
        if (meta.content instanceof RegExp) {
          if (meta.content.test(content)) {
            score += 3;
          }
        }
        // 如果meta.content是字符串，进行精确匹配
        else if (content === meta.content) {
          score += 3;
        }
      }
    }
  });

  // 检查全局变量
  if (Reflect.get(window, "gon")) {
    score += 2; // 存在gon对象就加分

    const gon = Reflect.get(window, "gon") as Record<string, any>;
    // 检查gon对象的特定属性
    if (gon.api_version || gon["api-version"]) {
      score += 1;
    }

    // 检查其他GitLab特有的gon属性
    const gitlabGonProperties = [
      "current_user_id",
      "current_username",
      "gitlab_url",
      "revision",
      "relative_url_root",
      "shortcuts_path",
      "current_project_id",
      "current_project_path",
    ];

    for (const prop of gitlabGonProperties) {
      if (prop in gon) {
        score += 0.5; // 每个匹配的属性增加0.5分
      }
    }
  }

  // 检查是否有GitLab相关的脚本
  const scripts = Array.from(document.querySelectorAll("script[src]"));
  for (const script of scripts) {
    const src = script.getAttribute("src") || "";
    if (src.includes("gitlab")) {
      score += 1;
    }
  }

  // 如果分数超过阈值，认为是GitLab页面
  return score >= 3;
}

/**
 * 检测当前页面是否是合并请求(Merge Request)页面
 * @returns {boolean} 是否是合并请求页面
 */
function isMergeRequestPage(): boolean {
  const url = window.location.href;
  return url.includes("/merge_requests/") && /\/merge_requests\/\d+/.test(url);
}

/**
 * 检测当前页面是否是代码审查相关页面
 * @returns {boolean} 是否是代码审查相关页面
 */
function isCodeReviewPage(): boolean {
  // 合并请求页面通常是代码审查页面
  if (isMergeRequestPage()) {
    return true;
  }

  // 检查是否在查看差异(diff)页面
  const url = window.location.href;
  if (
    url.includes("/diffs") ||
    url.includes("?view=parallel") ||
    url.includes("?view=inline")
  ) {
    return true;
  }

  // 检查是否有代码差异元素
  const hasDiffElements =
    !!document.querySelector(".diff-files-holder") ||
    !!document.querySelector(".diffs") ||
    !!document.querySelector(".diff-file");

  return hasDiffElements;
}

// 页面加载完成后执行检测
window.addEventListener("load", async () => {
  const isGitLab = await detectGitLab();
  const isReviewPage = isCodeReviewPage();

  // 向扩展的后台脚本发送检测结果
  browser.runtime.sendMessage({
    action: "gitlabDetected",
    isGitLab,
    isReviewPage,
    url: window.location.href,
    title: document.title,
  });

  // 如果是GitLab页面，添加一个标记类到body
  if (isGitLab) {
    document.body.classList.add("gitlab-detected");

    // 如果是代码审查页面，添加另一个标记类
    if (isReviewPage) {
      document.body.classList.add("gitlab-review-page");
    }
  }
});

// 监听URL变化，因为GitLab是SPA应用，页面可能不会完全重新加载
let lastUrl = window.location.href;
const observer = new MutationObserver(async () => {
  if (lastUrl !== window.location.href) {
    lastUrl = window.location.href;

    // URL变化后重新检测
    const isGitLab = await detectGitLab();
    const isReviewPage = isCodeReviewPage();

    browser.runtime.sendMessage({
      action: "gitlabUrlChanged",
      isGitLab,
      isReviewPage,
      url: window.location.href,
      title: document.title,
    });

    // 更新body上的标记类
    document.body.classList.toggle("gitlab-detected", isGitLab);
    document.body.classList.toggle(
      "gitlab-review-page",
      isGitLab && isReviewPage
    );
  }
});

// 开始观察DOM变化
observer.observe(document, { subtree: true, childList: true });

// 监听来自后台脚本的消息
browser.runtime.onMessage.addListener(async (message) => {
  switch (message.action) {
    case "getGitLabStatus": {
      const isGitLab = await detectGitLab();
      const isReviewPage = isCodeReviewPage();

      return {
        isGitLab,
        isReviewPage,
        url: window.location.href,
        title: document.title,
      };
    }

    case "settingsUpdated": {
      currentSettings = message.settings?.detctor;

      const isGitLab = await detectGitLab();
      const isReviewPage = isCodeReviewPage();

      // 更新body上的标记类
      document.body.classList.toggle("gitlab-detected", isGitLab);
      document.body.classList.toggle(
        "gitlab-review-page",
        isGitLab && isReviewPage
      );

      // 向后台脚本发送更新后的检测结果
      browser.runtime.sendMessage({
        action: "gitlabDetected",
        isGitLab,
        isReviewPage,
        url: window.location.href,
        title: document.title,
      });

      return true;
    }

    case "startAnalysis": {
    }

    default: {
      return false;
    }
  }
});

// 导出检测函数以便其他模块使用
export { detectGitLab, isCodeReviewPage, isMergeRequestPage };

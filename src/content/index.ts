import browser from "webextension-polyfill";
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { type DetectorSettings as Settings } from "../types/index.d";

/**
 * GitLab 内容脚本统一入口
 * 包含 GitLab 检测器和 API 代理功能
 */

// ====================== GitLab 检测器部分 ======================

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

// ====================== GitLab API 代理部分 ======================

// 定义请求类型
interface ApiRequest {
  method: string;
  url: string;
  data?: any;
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

// 定义响应类型
interface ApiResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code?: number;
    details?: any;
  };
}

// 创建一个 axios 实例
const apiClient = axios.create({
  // 不设置 baseURL，因为会根据不同的 GitLab 实例动态设置
  timeout: 30000, // 30秒超时
  withCredentials: true, // 启用 cookie
});

// 处理 API 请求
async function handleApiRequest(request: ApiRequest): Promise<ApiResponse> {
  try {
    const config: AxiosRequestConfig = {
      method: request.method,
      url: request.url,
      headers: {
        'Content-Type': 'application/json',
        ...request.headers,
      },
      withCredentials: true,
    };

    if (request.data) {
      config.data = request.data;
    }

    if (request.params) {
      config.params = request.params;
    }

    const response: AxiosResponse = await apiClient(config);

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error('API请求失败:', error);
    
    // 格式化错误响应
    const errorResponse: ApiResponse = {
      success: false,
      error: {
        message: error.message || '请求失败',
      },
    };

    // 确保 error 对象存在
    if (!errorResponse.error) {
      errorResponse.error = {
        message: '未知错误',
      };
    }

    // 如果是 Axios 错误，添加更多详细信息
    if (error.response) {
      if (errorResponse.error) {
        errorResponse.error.code = error.response.status;
        errorResponse.error.details = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        };
      }
    } else if (error.request) {
      if (errorResponse.error) {
        errorResponse.error.message = '服务器没有响应';
        errorResponse.error.details = {
          request: error.request,
        };
      }
    }

    return errorResponse;
  }
}

// 处理 GitLab 特定的 API 请求
async function handleGitLabApiRequest(
  host: string, 
  projectPath: string, 
  mrIId: string | number, 
  endpoint: string,
  method: string = 'GET',
  data?: any
): Promise<ApiResponse> {
  const baseUrl = `${host}/api/v4/projects/${projectPath}/merge_requests/${mrIId}`;
  const url = `${baseUrl}${endpoint}`;
  
  return handleApiRequest({
    method,
    url,
    data,
  });
}

// ====================== 初始化和事件监听 ======================

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
    
    console.log('GitLab 页面已检测到，API 代理已启用');
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

// 监听来自扩展其他部分的消息
browser.runtime.onMessage.addListener(async (message, sender) => {
  // 处理 GitLab 检测相关消息
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

    // 处理 API 相关消息
    case "apiRequest": {
      return handleApiRequest(message.request);
    }
    
    case "gitlabMrRequest": {
      return handleGitLabApiRequest(
        message.host,
        message.projectPath,
        message.mrIId,
        message.endpoint,
        message.method,
        message.data
      );
    }
    
    case "getMrChanges": {
      return handleGitLabApiRequest(
        message.host,
        message.projectPath,
        message.mrIId,
        '/changes',
        'GET'
      );
    }
    
    case "postMrComment": {
      console.log('处理 postMrComment 请求:', message);
      
      // 获取 CSRF Token
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      try {
        // 首先获取合并请求的真实 ID 和 diff_head_sha
        // 通过调用 changes API 获取必要信息
        const changesResponse = await handleGitLabApiRequest(
          message.host,
          message.projectPath,
          message.mrIId,
          '/changes',
          'GET'
        );
        
        if (!changesResponse.success) {
          console.error('获取合并请求信息失败:', changesResponse.error);
          return changesResponse;
        }
        
        // 从 changes 响应中提取真实的 merge_request_id 和 diff_head_sha
        const mrData = changesResponse.data;
        const realMrId = mrData.id; // 这是真实的数字 ID，不是 IID
        const diffHeadSha = mrData.diff_refs?.head_sha || message.diffHeadSha || '';
        
        console.log('获取到的合并请求信息:', { realMrId, diffHeadSha });
        
        // 根据用户提供的成功 curl 命令修改 URL
        // 使用完整的 URL 路径: noteable/merge_request/{id}/notes
        // 例如: https://jihulab.com/mizuka-wu1/gitlab-codereview-web-extension/noteable/merge_request/803142/notes
        let url = '';
        
        // 如果有原始的 mrUrl，使用它来构建正确的 URL
        if (message.mrUrl) {
          console.log('使用原始 mrUrl 构建 API URL:', message.mrUrl);
          const mrUrlObj = new URL(message.mrUrl);
          const pathParts = mrUrlObj.pathname.split('/');
          
          // 移除路径中的 '-/merge_requests/{iid}' 部分
          const projectPath = pathParts.slice(0, pathParts.indexOf('-') !== -1 ? 
                                              pathParts.indexOf('-') : 
                                              pathParts.indexOf('merge_requests'));
          
          // 构建新的 URL
          url = `${mrUrlObj.protocol}//${mrUrlObj.host}${projectPath.join('/')}/notes?target_id=${realMrId}&target_type=merge_request`;
        } else {
          // 如果没有 mrUrl，使用原来的方式
          const projectRoot = message.host.replace(/\/-\/merge_requests\/\d+(\/diffs)?$/, '');
          url = `${projectRoot}/notes?target_id=${realMrId}&target_type=merge_request`;
        }
        
        console.log('构建的 API URL:', url);
        
        // 构建符合成功 curl 命令的数据结构
        const originalData = message.data;
        
        // 确保评论内容不为空
        const noteContent = originalData.note || originalData.body || '';
        if (!noteContent || noteContent.trim() === '') {
          return {
            success: false,
            error: {
              message: '评论内容不能为空',
              details: { note: noteContent }
            }
          };
        }
        
        // 确保 position 对象完整
        let position = originalData.position || {};
        if (typeof position === 'string') {
          try {
            position = JSON.parse(position);
          } catch (e) {
            console.error('解析 position 字符串失败:', e);
          }
        }
        
        // 确保 position 对象包含必要字段
        position = {
          base_sha: position.base_sha || mrData.diff_refs?.base_sha || null,
          start_sha: position.start_sha || mrData.diff_refs?.start_sha || null,
          head_sha: diffHeadSha,
          old_path: position.old_path || position.new_path,
          new_path: position.new_path,
          position_type: position.position_type || 'text',
          old_line: position.old_line || null,
          new_line: position.new_line,
          line_code: position.line_code || '',
          ...position
        };
        
        // 确保必要的 SHA 值不为空
        if (!position.base_sha || !position.start_sha || !position.head_sha) {
          console.warn('缺少必要的 SHA 值，使用备用值');
          position.base_sha = position.base_sha || diffHeadSha;
          position.start_sha = position.start_sha || diffHeadSha;
          position.head_sha = position.head_sha || diffHeadSha;
        }
        
        // 构建 line_code
        let lineCode = '';
        
        // 生成临时 line_code 用于 line_range
        const tempLineCode = `generated_${Date.now()}_${position.old_line || 0}_${position.new_line || 0}`;
        
        // 确保 line_range 存在且完整
        if (!position.line_range || typeof position.line_range !== 'object') {
          position.line_range = {
            start: {
              line_code: tempLineCode,
              type: position.new_line ? 'new' : 'old',
              old_line: position.old_line || null,
              new_line: position.new_line || null
            },
            end: {
              line_code: tempLineCode,
              type: position.new_line ? 'new' : 'old',
              old_line: position.old_line || null,
              new_line: position.new_line || null
            }
          };
        }
        if (position.new_path && position.new_line) {
          // 从页面上获取 line_code
          const lineElements = document.querySelectorAll('[data-line-code]');
          // 转换为数组以使用迭代器
          Array.from(lineElements).forEach(element => {
            const code = element.getAttribute('data-line-code');
            if (code && code.includes(`_${position.old_line || 0}_${position.new_line}`)) {
              lineCode = code;
            }
          });
          
          // 如果找不到，尝试构建一个
          if (!lineCode) {
            // 提取当前文件的 blob id 或使用简单哈希
            const fileId = document.querySelector(`[data-path="${position.new_path}"]`)?.getAttribute('data-blob-id') || '';
            if (!fileId) {
              // 如果没有找到 blob id，使用简单的哈希函数生成一个
              const hashCode = (str: string) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                  const char = str.charCodeAt(i);
                  hash = ((hash << 5) - hash) + char;
                  hash = hash & hash; // Convert to 32bit integer
                }
                return Math.abs(hash).toString(16);
              };
              const generatedId = hashCode(position.new_path);
              lineCode = `${generatedId}_${position.old_line || 0}_${position.new_line}`;
            } else {
              lineCode = `${fileId}_${position.old_line || 0}_${position.new_line}`;
            }
          }
        }
        
        // 确保 lineCode 不为空
        if (!lineCode && position.new_path) {
          // 如果还是没有 lineCode，生成一个默认的
          const timestamp = Date.now();
          lineCode = `generated_${timestamp}_${position.old_line || 0}_${position.new_line || 0}`;
        }
        
        console.log('构建的 line_code:', lineCode);
        
        // 根据成功的 curl 命令构建完整的请求数据结构
        const notesData = {
          view: "inline",
          line_type: "old",
          merge_request_diff_head_sha: diffHeadSha,
          in_reply_to_discussion_id: "",
          note_project_id: "",
          target_type: "merge_request",
          target_id: realMrId,
          return_discussion: true,
          note: {
            note: noteContent,
            position: JSON.stringify(position),
            noteable_type: "MergeRequest",
            noteable_id: realMrId,
            commit_id: null,
            type: "DiffNote",
            line_code: lineCode
          }
        };
      
      console.log('提交评论请求:', {
        url,
        notesData
      });
      
      // 使用 handleApiRequest 发送请求
      return handleApiRequest({
        method: 'POST',
        url,
        data: notesData,
        headers: {
          'X-CSRF-Token': csrfToken || '',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      } catch (error) {
        console.error('处理评论请求时发生错误:', error);
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : '未知错误'
          },
          message: '处理评论请求失败'
        };
      }
    }

    default: {
      return false;
    }
  }
});

// 导出检测函数以便其他模块使用
export { detectGitLab, isCodeReviewPage, isMergeRequestPage };

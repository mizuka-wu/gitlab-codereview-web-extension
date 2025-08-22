import browser from "webextension-polyfill";
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * GitLab API 代理
 * 用于在 content script 中执行 GitLab API 请求，解决 cookie 和跨域问题
 */

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

// 获取 CSRF Token
function getCSRFToken(): string | null {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag ? metaTag.getAttribute('content') : null;
}

// 处理 API 请求
async function handleApiRequest(request: ApiRequest): Promise<ApiResponse> {
  try {
    // 获取 CSRF Token
    const csrfToken = getCSRFToken();
    
    const config: AxiosRequestConfig = {
      method: request.method,
      url: request.url,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
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
    
    // 调试信息
    console.log('API请求配置:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      csrfToken
    });

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
  data?: any,
  headers?: Record<string, string>
): Promise<ApiResponse> {
  // 对项目路径进行编码
  const encodedProjectPath = encodeURIComponent(projectPath);
  const baseUrl = `${host}/api/v4/projects/${encodedProjectPath}/merge_requests/${mrIId}`;
  const url = `${baseUrl}${endpoint}`;
  
  return handleApiRequest({
    method,
    url,
    data,
    headers,
  });
}

// 监听来自扩展其他部分的消息
browser.runtime.onMessage.addListener(async (message, sender) => {
  // 只处理 API 相关的请求
  if (message.action === 'apiRequest') {
    return handleApiRequest(message.request);
  }
  
  // 处理 GitLab MR 相关的请求
  if (message.action === 'gitlabMrRequest') {
    return handleGitLabApiRequest(
      message.host,
      message.projectPath,
      message.mrIId,
      message.endpoint,
      message.method,
      message.data
    );
  }
  
  // 获取 MR 变更
  if (message.action === 'getMrChanges') {
    return handleGitLabApiRequest(
      message.host,
      message.projectPath,
      message.mrIId,
      '/changes',
      'GET'
    );
  }
  
  // 提交 MR 评论
  if (message.action === 'postMrComment') {
    // 当上游传入 useRawPosition=true 时，交由 src/content/index.ts 处理，避免与 notes 回退实现冲突
    if (message.useRawPosition) {
      return false;
    }
    // 尝试使用 notes 接口替代 discussions 接口
    // 根据您提供的 curl 命令，notes 接口可以正常工作
    const csrfToken = getCSRFToken();
    const headers = {
      'X-CSRF-Token': csrfToken || '',
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    console.log('提交评论:', {
      host: message.host,
      projectPath: message.projectPath,
      mrIId: message.mrIId,
      data: message.data,
      headers
    });
    
    // 先尝试使用 notes 接口
    try {
      // 构建直接请求 notes 接口的 URL
      const encodedProjectPath = encodeURIComponent(message.projectPath);
      const url = `${message.host}/api/v4/projects/${encodedProjectPath}/merge_requests/${message.mrIId}/notes`;
      
      return handleApiRequest({
        method: 'POST',
        url,
        data: message.data,
        headers
      });
    } catch (error) {
      console.error('使用 notes 接口失败，尝试 discussions 接口', error);
      // 如果 notes 接口失败，回退到 discussions 接口
      return handleGitLabApiRequest(
        message.host,
        message.projectPath,
        message.mrIId,
        '/discussions',
        'POST',
        message.data,
        headers
      );
    }
  }
  
  return false;
});

console.log('GitLab API 代理已加载');

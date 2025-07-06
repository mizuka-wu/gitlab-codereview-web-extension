import browser from "webextension-polyfill";
import { v4 as uuid } from 'uuid';

/**
 * GitLab 管理器代理类
 * 通过 content script 代理进行 GitLab API 请求
 */
export default class GitlabProxyManager {
  private mrUrl: string;
  private host: string;
  private projectPath: string;
  private mrIId: string;
  private ref: string | undefined = undefined;

  /**
   * 构造函数
   * @param options 选项
   */
  constructor(options: { mrUrl: string }) {
    this.mrUrl = options.mrUrl;
    const parsedInfo = this.parseMergeRequestUrl(this.mrUrl);
    this.host = parsedInfo.host;
    this.projectPath = parsedInfo.projectPath;
    this.mrIId = parsedInfo.mrIId;
  }

  /**
   * 解析合并请求 URL
   * @param url 合并请求 URL
   * @returns 解析后的信息
   */
  private parseMergeRequestUrl(url: string) {
    try {
      const urlObj = new URL(url);
      const host = `${urlObj.protocol}//${urlObj.host}`;
      
      // 移除开头的斜杠
      const pathParts = urlObj.pathname.replace(/^\//, '').split('/');
      
      // GitLab URL 格式: /{namespace}/{project}/merge_requests/{iid}
      // 或者 /{namespace}/{project}/-/merge_requests/{iid}
      let projectPath = '';
      let mrIId = '';
      
      const mrIndex = pathParts.findIndex(part => part === 'merge_requests');
      if (mrIndex > 0) {
        // 如果路径中有 '-' 部分，则需要特殊处理
        if (pathParts[mrIndex - 1] === '-') {
          projectPath = encodeURIComponent(`${pathParts[0]}/${pathParts[1]}`);
        } else {
          // 否则，项目路径就是前两部分
          projectPath = encodeURIComponent(`${pathParts[0]}/${pathParts[1]}`);
        }
        
        // MR ID 是 'merge_requests' 后面的部分
        mrIId = pathParts[mrIndex + 1];
      }
      
      return { host, projectPath, mrIId };
    } catch (error) {
      console.error('解析合并请求 URL 失败:', error);
      throw new Error('无效的合并请求 URL');
    }
  }

  /**
   * 发送消息到 content script
   * @param action 操作类型
   * @param data 数据
   * @returns 响应
   */
  private async sendMessage(action: string, data: any = {}) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        throw new Error('找不到活动标签页');
      }
      
      const response = await browser.tabs.sendMessage(tabs[0].id, {
        action,
        host: this.host,
        projectPath: this.projectPath,
        mrIId: this.mrIId,
        ...data
      });
      
      if (!response || !response.success) {
        const errorMsg = response?.error?.message || '请求失败';
        const errorDetails = response?.error?.details ? JSON.stringify(response.error.details) : '';
        throw new Error(`${errorMsg}${errorDetails ? ': ' + errorDetails : ''}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  /**
   * 获取合并请求变更
   * @returns 变更列表和引用
   */
  async getChanges() {
    try {
      const data = await this.sendMessage('getMrChanges');
      
      // 保存引用，用于后续操作
      this.ref = data.changes_count > 0 ? data.changes[0].new_path : undefined;
      
      return {
        changes: data.changes || [],
        ref: this.ref
      };
    } catch (error) {
      console.error('获取变更失败:', error);
      throw error;
    }
  }

  /**
   * 提交评论
   * @param options 评论选项
   * @returns 评论结果
   */
  async postComment({ newPath, newLine, oldPath, oldLine, body, ref }: {
    newPath?: string;
    newLine?: number;
    oldPath?: string;
    oldLine?: number;
    body: string;
    ref?: string;
  }) {
    console.log('提交评论参数:', { newPath, newLine, oldPath, oldLine, body, ref });
    
    // 获取当前页面上的 MR 信息
    let diffHeadSha = '';
    let lineCode = '';
    
    try {
      // 首先尝试获取合并请求信息以获取最准确的 diffHeadSha
      try {
        const changesData = await this.sendMessage('getMrChanges');
        if (changesData && changesData.diff_refs) {
          diffHeadSha = changesData.diff_refs.head_sha || '';
          console.log('从 changes API 获取到的 diffHeadSha:', diffHeadSha);
        }
      } catch (changesError) {
        console.warn('获取 changes API 失败，尝试其他方式获取 diffHeadSha:', changesError);
      }
      
      // 如果 API 获取失败，尝试从页面 DOM 获取
      if (!diffHeadSha) {
        // 尝试多种选择器以提高兼容性
        const selectors = [
          '[data-commit-sha]',
          '[data-merge-request-diff-head-sha]',
          '[data-diff-head-sha]',
          '.merge-request-diff-head-sha',
          '.js-merge-request-diff-head-sha'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const sha = element.getAttribute('data-commit-sha') || 
                      element.getAttribute('data-merge-request-diff-head-sha') || 
                      element.getAttribute('data-diff-head-sha') || 
                      element.textContent?.trim();
            
            if (sha) {
              diffHeadSha = sha;
              console.log(`从选择器 ${selector} 获取到的 diffHeadSha:`, diffHeadSha);
              break;
            }
          }
        }
      }
      
      // 如果有行号，尝试构建或获取 lineCode
      if (newPath && newLine) {
        // 首先尝试从页面元素获取
        try {
          // 构建可能的选择器
          const lineSelectors = [
            `[data-path="${newPath}"] [data-line-number="${newLine}"] [data-line-code]`,
            `[data-file-path="${newPath}"] [data-line-number="${newLine}"] [data-line-code]`,
            `[data-line-number="${newLine}"][data-line-code]`
          ];
          
          for (const selector of lineSelectors) {
            const lineElement = document.querySelector(selector);
            if (lineElement) {
              const code = lineElement.getAttribute('data-line-code');
              if (code) {
                lineCode = code;
                console.log(`从选择器 ${selector} 获取到的 lineCode:`, lineCode);
                break;
              }
            }
          }
        } catch (domError) {
          console.warn('从 DOM 获取 lineCode 失败:', domError);
        }
        
        // 如果无法从 DOM 获取，则构建一个
        if (!lineCode) {
          // 尝试获取文件的 blob id
          let fileId = '';
          try {
            const fileElement = document.querySelector(`[data-path="${newPath}"]`) || 
                               document.querySelector(`[data-file-path="${newPath}"]`);
            if (fileElement) {
              fileId = fileElement.getAttribute('data-blob-id') || '';
            }
          } catch (error) {
            console.warn('获取文件 blob id 失败:', error);
          }
          
          // 如果没有 blob id，使用路径哈希
          if (!fileId) {
            fileId = this.hashCode(newPath);
          }
          
          lineCode = `${fileId}_${oldLine || 0}_${newLine}`;
          console.log('构建的 lineCode:', lineCode);
        }
      }
    } catch (error) {
      console.error('获取 MR 信息失败:', error);
    }

    // 构建位置信息，根据用户提供的成功 curl 命令和 GitLab API 文档
    const position = {
      base_sha: null,
      start_sha: null,
      head_sha: diffHeadSha,
      old_path: oldPath || newPath, // 确保始终有路径
      new_path: newPath || oldPath, // 确保始终有路径
      position_type: 'text',
      old_line: oldLine || null,
      new_line: newLine || null,
      line_code: lineCode, // 直接在根级别添加 line_code
      line_range: newLine ? {
        start: {
          line_code: lineCode,
          type: newLine ? "new" : "old",
          old_line: oldLine || null,
          new_line: newLine || null
        },
        end: {
          line_code: lineCode,
          type: newLine ? "new" : "old",
          old_line: oldLine || null,
          new_line: newLine || null
        }
      } : undefined,
      ignore_whitespace_change: false
    };

    // 根据成功的 curl 命令简化数据结构
    const data = {
      note: body, // 使用 body 参数作为 note 字段的值
      position: JSON.stringify(position),
      line_code: lineCode,
      merge_request_diff_head_sha: diffHeadSha
    };
    
    // 传递原始 URL 信息，以便 content script 构建正确的 URL
    const mrUrl = this.mrUrl;

    console.log('提交评论数据:', data);
    return this.sendMessage('postMrComment', { data, mrUrl });
  }
  
  /**
   * 简单的字符串哈希函数
   * @param str 要哈希的字符串
   * @returns 哈希值
   */
  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16); // 转为16进制
  }

  /**
   * 代码审查
   * @param options 审查选项
   * @returns 审查结果
   */
  async codeReview({ change, message, ref }: {
    change: any;
    message: string;
    ref?: string;
  }) {
    // 确保评论内容不为空
    if (!message || message.trim() === '') {
      throw new Error('评论内容不能为空');
    }
    // 根据变更类型决定如何提交评论
    if (change.new_file) {
      // 新文件，评论放在第一行
      return this.postComment({
        newPath: change.new_path,
        newLine: 1,
        body: message,
        ref: ref || this.ref || undefined,
      });
    } else if (change.deleted_file) {
      // 删除的文件，评论放在旧文件的第一行
      return this.postComment({
        oldPath: change.old_path,
        oldLine: 1,
        body: message,
        ref: ref || this.ref || undefined,
      });
    } else if (change.renamed_file) {
      // 重命名的文件，评论放在新文件的第一行
      return this.postComment({
        newPath: change.new_path,
        newLine: 1,
        oldPath: change.old_path,
        oldLine: 1,
        body: message,
        ref: ref || this.ref || undefined,
      });
    } else {
      // 修改的文件，评论放在第一个变更的行
      // 这里简化处理，实际项目中可能需要更复杂的逻辑
      const diffLines = change.diff.split('\n');
      let lineNumber = 1;
      
      for (let i = 0; i < diffLines.length; i++) {
        const line = diffLines[i];
        if (line.startsWith('+') && !line.startsWith('+++')) {
          lineNumber = i + 1;
          break;
        }
      }
      
      return this.postComment({
        newPath: change.new_path,
        newLine: lineNumber,
        oldPath: change.old_path,
        oldLine: lineNumber,
        body: message,
        ref: ref || this.ref || undefined,
      });
    }
  }
}

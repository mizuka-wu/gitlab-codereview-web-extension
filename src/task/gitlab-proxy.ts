import browser from "webextension-polyfill";
import { stripThinkTags, isNoSuggestionMessage, getNoSuggestionMatch } from "../utils/review";

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
   * 解析 unified diff，返回首个新增行/删除行在新旧文件中的绝对行号
   */
  private parseDiffFirstPositions(diff: string): { firstAddedNewLine?: number; firstRemovedOldLine?: number } {
    const lines = diff.split('\n');
    let currentOld = 0;
    let currentNew = 0;
    let inHunk = false;
    let firstAddedNewLine: number | undefined;
    let firstRemovedOldLine: number | undefined;

    const hunkHeader = /^@@\s+-(?<oldStart>\d+)(?:,(?<oldCount>\d+))?\s+\+(?<newStart>\d+)(?:,(?<newCount>\d+))?\s+@@/;

    for (const raw of lines) {
      const line = raw || '';
      const m = line.match(hunkHeader);
      if (m && m.groups) {
        inHunk = true;
        currentOld = parseInt(m.groups.oldStart || '0', 10);
        currentNew = parseInt(m.groups.newStart || '0', 10);
        continue;
      }
      if (!inHunk) continue;

      if (line.startsWith('+')) {
        if (line.startsWith('+++')) {
          // file header, ignore
        } else {
          if (firstAddedNewLine === undefined) firstAddedNewLine = currentNew;
          currentNew++;
        }
        continue;
      }
      if (line.startsWith('-')) {
        if (line.startsWith('---')) {
          // file header, ignore
        } else {
          if (firstRemovedOldLine === undefined) firstRemovedOldLine = currentOld;
          currentOld++;
        }
        continue;
      }
      if (line.startsWith(' ')) {
        currentOld++;
        currentNew++;
        continue;
      }
      // e.g. "\\ No newline at end of file" or empty -> ignore
    }

    return { firstAddedNewLine, firstRemovedOldLine };
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

      // 提取 diff_refs 信息
      const diffRefs = data?.diff_refs || {};
      const headSha = diffRefs.head_sha || undefined;
      const baseSha = diffRefs.base_sha || undefined;
      const startSha = diffRefs.start_sha || undefined;

      // 保存引用（兼容旧逻辑，优先使用 headSha）
      this.ref = headSha || (data.changes_count > 0 ? data.changes[0].new_path : undefined);

      return {
        changes: data.changes || [],
        ref: this.ref,
        headSha,
        baseSha,
        startSha,
      };
    } catch (error) {
      console.error('获取变更失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定提交下某个文件的原始内容（raw）
   */
  async getRawFileContent(params: { filePath: string; sha: string }) {
    const projectPathDecoded = decodeURIComponent(this.projectPath);
    const url = `${this.host}/${projectPathDecoded}/-/raw/${params.sha}/${encodeURI(params.filePath)}`;
    const res = await this.sendMessage('apiRequest', {
      request: {
        method: 'GET',
        url,
      },
    });
    return typeof res === 'string' ? res : (res?.toString?.() ?? '');
  }

  /**
   * 提交评论
   * @param options 评论选项
   * @returns 评论结果
   */
  async postComment({ newPath, newLine, oldPath, oldLine, body, ref, lineRange }: {
    newPath?: string;
    newLine?: number;
    oldPath?: string;
    oldLine?: number;
    body: string;
    ref?: { headSha?: string; baseSha?: string; startSha?: string };
    // 可选的多行范围
    lineRange?: {
      start: { type: 'new' | 'old'; new_line?: number | null; old_line?: number | null };
      end: { type: 'new' | 'old'; new_line?: number | null; old_line?: number | null };
    };
  }) {
    const sanitizedBody = stripThinkTags(body);
    console.log('提交评论参数:', { newPath, newLine, oldPath, oldLine, body: sanitizedBody, ref });

    // 仅从 API 获取 diff refs，避免 DOM 探测引入误差
    const { headSha, baseSha, startSha } = await this.getDiffRefsSafe();

    // 构建最小且准确的 discussions position（对齐参考实现）
    const position: Record<string, any> = {
      position_type: 'text',
      base_sha: ref?.baseSha ?? baseSha ?? null,
      head_sha: ref?.headSha ?? headSha ?? null,
      start_sha: ref?.startSha ?? startSha ?? null,
      new_path: newPath,
      new_line: typeof newLine === 'number' ? newLine : undefined,
      old_path: oldPath,
      old_line: typeof oldLine === 'number' ? oldLine : undefined,
    };

    if (lineRange) {
      position.line_range = lineRange;
    }

    const data = {
      body: sanitizedBody,
      position,
    };

    // 传递原始 URL 信息，以便 content script 构建正确的 URL
    const mrUrl = this.mrUrl;

    console.log('提交评论数据:', data);
    return this.sendMessage('postMrComment', { data, mrUrl, useRawPosition: true });
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
    return Math.abs(hash).toString(16); // 转为正数的16进制，避免出现负号
  }

  // stripThinkTags / isNoSuggestionMessage 由公共工具模块提供

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
    // 先移除 <think> 内容后再校验是否为空
    const sanitizedMessage = stripThinkTags(message);
    if (!sanitizedMessage || sanitizedMessage.trim() === '') {
      throw new Error('评论内容不能为空');
    }
    // 若 AI 表示“无建议”，跳过创建讨论
    const noSugHit = getNoSuggestionMatch(sanitizedMessage);
    if (noSugHit) {
      console.log('AI 返回无建议，跳过创建讨论', {
        patternIndex: noSugHit.index,
        pattern: noSugHit.pattern,
        matched: noSugHit.matched,
        normalized: noSugHit.normalized,
        original: noSugHit.original,
      });
      return { skipped: true, reason: 'no_suggestion', details: noSugHit } as any;
    }
    // 尝试从消息中解析范围（显式行号或代码片段）
    const derivedRange = await this.deriveLineRangeFromMessage({ change, message });

    // 获取 diff refs 并构造 ref 对象，按参考实现传递
    const { headSha, baseSha, startSha } = await this.getDiffRefsSafe();
    const refObj = { headSha, baseSha, startSha };

    // 根据变更类型决定如何提交评论
    if (change.new_file) {
      // 新文件：使用首个新增行（若找不到则回退到 1）
      const { firstAddedNewLine } = this.parseDiffFirstPositions(change.diff || '');
      return this.postComment({
        newPath: change.new_path,
        newLine: derivedRange?.side === 'new' ? (derivedRange.start ?? (firstAddedNewLine ?? 1)) : (firstAddedNewLine ?? 1),
        lineRange: derivedRange?.side === 'new' && derivedRange.end && derivedRange.start
          ? {
              start: { type: 'new', new_line: derivedRange.start, old_line: null },
              end: { type: 'new', new_line: derivedRange.end, old_line: null },
            }
          : undefined,
        body: sanitizedMessage,
        ref: refObj,
      });
    } else if (change.deleted_file) {
      // 删除的文件：使用首个删除行（若找不到则回退到 1）
      const { firstRemovedOldLine } = this.parseDiffFirstPositions(change.diff || '');
      return this.postComment({
        oldPath: change.old_path,
        oldLine: derivedRange?.side === 'old' ? (derivedRange.start ?? (firstRemovedOldLine ?? 1)) : (firstRemovedOldLine ?? 1),
        lineRange: derivedRange?.side === 'old' && derivedRange.end && derivedRange.start
          ? {
              start: { type: 'old', new_line: null, old_line: derivedRange.start },
              end: { type: 'old', new_line: null, old_line: derivedRange.end },
            }
          : undefined,
        body: sanitizedMessage,
        ref: refObj,
      });
    } else if (change.renamed_file) {
      // 重命名：按新增侧
      const { firstAddedNewLine } = this.parseDiffFirstPositions(change.diff || '');
      return this.postComment({
        newPath: change.new_path,
        oldPath: change.old_path,
        newLine: derivedRange?.side === 'new' ? (derivedRange.start ?? (firstAddedNewLine ?? 1)) : (firstAddedNewLine ?? 1),
        lineRange: derivedRange?.side === 'new' && derivedRange.end && derivedRange.start
          ? {
              start: { type: 'new', new_line: derivedRange.start, old_line: null },
              end: { type: 'new', new_line: derivedRange.end, old_line: null },
            }
          : undefined,
        body: sanitizedMessage,
        ref: refObj,
      });
    } else {
      // 修改文件：优先使用新增侧；若无新增则使用删除侧
      const { firstAddedNewLine, firstRemovedOldLine } = this.parseDiffFirstPositions(change.diff || '');
      if (firstAddedNewLine !== undefined) {
        return this.postComment({
          newPath: change.new_path,
          oldPath: change.old_path,
          newLine: derivedRange?.side === 'new' ? (derivedRange.start ?? firstAddedNewLine) : firstAddedNewLine,
          lineRange: derivedRange?.side === 'new' && derivedRange.end && derivedRange.start
            ? {
                start: { type: 'new', new_line: derivedRange.start, old_line: null },
                end: { type: 'new', new_line: derivedRange.end, old_line: null },
              }
            : undefined,
          body: sanitizedMessage,
          ref: refObj,
        });
      }
      if (firstRemovedOldLine !== undefined) {
        return this.postComment({
          newPath: change.new_path,
          oldPath: change.old_path,
          oldLine: derivedRange?.side === 'old' ? (derivedRange.start ?? firstRemovedOldLine) : firstRemovedOldLine,
          lineRange: derivedRange?.side === 'old' && derivedRange.end && derivedRange.start
            ? {
                start: { type: 'old', new_line: null, old_line: derivedRange.start },
                end: { type: 'old', new_line: null, old_line: derivedRange.end },
              }
            : undefined,
          body: sanitizedMessage,
          ref: refObj,
        });
      }
      // 回退：无法解析时选择文件首行（新增侧）
      return this.postComment({
        newPath: change.new_path,
        oldPath: change.old_path,
        newLine: 1,
        body: sanitizedMessage,
        ref: refObj,
      });
    }
  }

  /**
   * 从 AI 回复中推断多行范围。
   * 1) 解析显式行号范围（L10-20 / lines 10-20 / 第10~20行）
   * 2) 若无显式范围，提取首个代码块并在新文件内容中定位，得到起止行
   */
  private async deriveLineRangeFromMessage({ change, message }: { change: any; message: string }): Promise<{ side: 'new' | 'old'; start?: number; end?: number } | undefined> {
    const text = stripThinkTags(message || '');
    // 1) 显式范围
    const m = text.match(/(?:L|lines?\s+|第)(\d+)\s*(?:-|~|到|—)\s*L?(\d+)\s*行?/i);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const start = Math.max(1, Math.min(a, b));
        const end = Math.max(a, b);
        // 修改/新文件默认按新增侧，删除文件按旧侧
        const side: 'new' | 'old' = change.deleted_file ? 'old' : 'new';
        return { side, start, end };
      }
    }

    // 2) 代码块定位到新文件
    const codeBlock = this.extractFirstCodeBlock(text);
    if (!codeBlock) return undefined;

    try {
      const { headSha } = await this.getDiffRefsSafe();
      if (!headSha || !change?.new_path) return undefined;
      const fileText = await this.getRawFileContent({ filePath: change.new_path, sha: headSha });
      const range = this.findSnippetRangeInText(codeBlock, fileText);
      if (range) {
        return { side: 'new', start: range.start, end: range.end };
      }
    } catch (e) {
      console.warn('从代码块定位范围失败:', e);
    }
    return undefined;
  }

  // 提取首个 ``` 代码块内容
  private extractFirstCodeBlock(text: string): string | undefined {
    const m = text.match(/```[\s\S]*?\n([\s\S]*?)```/);
    const content = m?.[1]?.trim();
    if (!content) return undefined;
    // 过长时截断，避免极端开销
    return content.length > 4000 ? content.slice(0, 4000) : content;
  }

  // 在目标文本中寻找代码片段的行区间（尽量用前若干非空行做定位）
  private findSnippetRangeInText(snippet: string, target: string): { start: number; end: number } | undefined {
    const snippetLines = snippet.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (snippetLines.length === 0) return undefined;
    // 尝试用前 3 行进行定位，逐步退化到 1 行
    for (let k = Math.min(3, snippetLines.length); k >= 1; k--) {
      const head = snippetLines.slice(0, k).join('\n');
      const idx = target.indexOf(head);
      if (idx >= 0) {
        // 计算起始行号
        const before = target.slice(0, idx);
        const startLine = before.split(/\r?\n/).length; // 基于 1 的行号
        // 估算结束行号：用整个片段行数
        const endLine = startLine + snippetLines.length - 1;
        return { start: startLine, end: Math.max(startLine, endLine) };
      }
    }
    return undefined;
  }

  // 安全获取 diff 引用
  private async getDiffRefsSafe(): Promise<{ headSha?: string; baseSha?: string; startSha?: string }> {
    try {
      const data = await this.sendMessage('getMrChanges');
      const diffRefs = data?.diff_refs || {};
      return { headSha: diffRefs.head_sha, baseSha: diffRefs.base_sha, startSha: diffRefs.start_sha };
    } catch {
      return {};
    }
  }
}

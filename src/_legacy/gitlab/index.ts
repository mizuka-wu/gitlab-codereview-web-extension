import axios, { AxiosInstance } from 'axios';
import camelCase from 'camelcase';

export interface GitlabDiffRef {
  baseSha: string;
  headSha: string;
  startSha: string;
}

export interface GitlabChange {
  newPath: string;
  oldPath: string;
  diff: string;
  lastNewLine?: number;
  lastOldLine?: number;
  newFile: boolean;
  renamedFile: boolean;
  deletedFile: boolean;
}

export interface GitlabConfig {
  mrUrl: string;
  target?: RegExp;
}

const parseMrUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/-/merge_requests/');
    const projectPath = pathParts[0].replace(/^\/+|\/+$/g, '');
    const mrIId = pathParts[1].split('/')[0];
    
    return {
      host: `${urlObj.protocol}//${urlObj.host}`,
      projectPath: encodeURIComponent(projectPath),
      mrIId: parseInt(mrIId, 10) || mrIId
    };
  } catch (error) {
    throw new Error('Invalid MR URL');
  }
};

export default class GitlabManager {
  private projectPath: string;
  private mrIId: number | string;
  private host: string;
  private request: AxiosInstance;
  private target: RegExp;

  constructor(config: GitlabConfig) {
    const { host, projectPath, mrIId } = parseMrUrl(config.mrUrl);
    
    this.host = host;
    this.projectPath = projectPath;
    this.mrIId = mrIId;
    this.target = config.target || /\.(j|t)sx?$/;
    
    this.request = axios.create({
      baseURL: `${this.host}/api/v4`,
      withCredentials: true, // 启用cookie
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private formatByCamelCase(obj: Record<string, any>) {
    return Object.keys(obj).reduce((result, key) => ({
      ...result,
      [camelCase(key)]: obj[key]
    }), {});
  }

  private parseLastDiff(gitDiff: string) {
    const diffList = gitDiff.split('\n').reverse();
    const lastLineFirstChar = diffList?.[1]?.[0];
    const lastDiff =
      diffList.find((item) => /^@@ \-\d+,\d+ \+\d+,\d+ @@/g.test(item)) || '';

    const [lastOldLineCount, lastNewLineCount] = lastDiff
      .replace(/@@ \-(\d+),(\d+) \+(\d+),(\d+) @@.*/g, (_, $1, $2, $3, $4) => {
        return `${+$1 + +$2},${+$3 + +$4}`;
      })
      .split(',');

    if (!/^\d+$/.test(lastOldLineCount) || !/^\d+$/.test(lastNewLineCount)) {
      return {
        lastOldLine: -1,
        lastNewLine: -1,
      };
    }

    const lastOldLine = lastLineFirstChar === '+' ? -1 : (parseInt(lastOldLineCount) || 0) - 1;
    const lastNewLine = lastLineFirstChar === '-' ? -1 : (parseInt(lastNewLineCount) || 0) - 1;

    return { lastOldLine, lastNewLine };
  }

  async getChanges() {
    try {
      const response = await this.request.get(
        `/projects/${this.projectPath}/merge_requests/${this.mrIId}/changes`
      );
      
      const { changes = [], diff_refs: diffRef } = response.data;
      
      const codeChanges: GitlabChange[] = changes
        .map((item: any) => this.formatByCamelCase(item))
        .filter((item: any) => {
          const { newPath, renamedFile, deletedFile } = item;
          if (renamedFile || deletedFile) {
            return false;
          }
          return this.target.test(newPath);
        })
        .map((item: any) => {
          const { lastOldLine, lastNewLine } = this.parseLastDiff(item.diff);
          return { ...item, lastNewLine, lastOldLine };
        });

      return {
        changes: codeChanges,
        ref: this.formatByCamelCase(diffRef) as GitlabDiffRef,
      };
    } catch (error) {
      console.error('Failed to get changes:', error);
      throw error;
    }
  }

  async postComment({
    newPath,
    newLine,
    oldPath,
    oldLine,
    body,
    ref,
  }: {
    newPath?: string;
    newLine?: number;
    oldPath?: string;
    oldLine?: number;
    body: string;
    ref: GitlabDiffRef;
  }) {
    try {
      await this.request.post(
        `/projects/${this.projectPath}/merge_requests/${this.mrIId}/discussions`,
        {
          body,
          position: {
            position_type: 'text',
            base_sha: ref?.baseSha,
            head_sha: ref?.headSha,
            start_sha: ref?.startSha,
            new_path: newPath,
            new_line: newLine,
            old_path: oldPath,
            old_line: oldLine,
          },
        }
      );
    } catch (error) {
      console.error('Failed to post comment:', error);
      throw error;
    }
  }

  async codeReview({
    change,
    message,
    ref,
  }: {
    change: GitlabChange;
    message: string;
    ref: GitlabDiffRef;
  }) {
    const { lastNewLine = -1, lastOldLine = -1, newPath, oldPath } = change;

    if (lastNewLine === -1 && lastOldLine === -1) {
      throw new Error('Invalid line numbers for code review');
    }

    const params: { oldLine?: number; oldPath?: string; newLine?: number; newPath?: string } = {};

    if (lastOldLine !== -1) {
      params.oldLine = lastOldLine;
      params.oldPath = oldPath;
    }

    if (lastNewLine !== -1) {
      params.newLine = lastNewLine;
      params.newPath = newPath;
    }

    return this.postComment({
      ...params,
      body: message,
      ref,
    });
  }
}

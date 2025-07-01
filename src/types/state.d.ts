// 存储GitLab检测状态
export interface GitLabDetectionState {
  isGitLab: boolean;
  isReviewPage: boolean;
  url: string;
  title: string;
  timestamp: number;
}

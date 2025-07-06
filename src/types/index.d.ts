import { Options as OllamaOptions } from "./aiAgent/ollama";
export { Options as OllamaOptions } from "./aiAgent/ollama";

// 存储GitLab检测状态
export interface GitLabDetection {
  isGitLab: boolean;
  isReviewPage: boolean;
  url: string;
  title: string;
  timestamp: number;
}

export const AiAgents = ["ollama"] as const;

export interface DetectorSettings {
  isEnable: boolean;
}
export interface PromptSettings {
  template: string;
}
export interface AiAgentSettings {
  current: (typeof AiAgents)[number];
  aiAgentConfig: Partial<{
    ollama: OllamaOptions;
  }>;
}
export type Settings<T = Record<string, string>> = {
  /** 发现页面 */
  detctor: DetectorSettings;
  /** AiAgent配置 */
  aiAgent: AiAgentSettings;
  /** 提示词配置 */
  prompt: PromptSettings;
};

export * from "./task/index.d";

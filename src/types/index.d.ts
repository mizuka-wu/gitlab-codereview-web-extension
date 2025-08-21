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

export const AiAgents = ["ollama", "openai", "claude", "openapi"] as const;

export type Locale = "zh-CN" | "en-US";

export interface DetectorSettings {
  isEnable: boolean;
}
export interface PromptSettings {
  template: string;
}

export interface ApiConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
  // OpenAPI 兼容服务的额外配置
  customHeaders?: Record<string, string>;
  customParams?: Record<string, any>;
  requestMethod?: 'POST' | 'PUT' | 'PATCH';
  contentType?: string;
  authType?: 'bearer' | 'header' | 'query' | 'none';
  authHeaderName?: string;
  authQueryName?: string;
}

export interface AiAgentSettings {
  current: (typeof AiAgents)[number];
  aiAgentConfig: Partial<{
    ollama: OllamaOptions;
    openai: ApiConfig;
    claude: ApiConfig;
    openapi: ApiConfig;
  }>;
}
export type Settings<T = Record<string, string>> = {
  /** 发现页面 */
  detctor: DetectorSettings;
  /** AiAgent配置 */
  aiAgent: AiAgentSettings;
  /** 提示词配置 */
  prompt: PromptSettings;
  /** 界面语言 */
  locale?: Locale;
};

export * from "./task/index.d";

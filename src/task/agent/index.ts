import browser from "webextension-polyfill";
import { generateWithAgent } from "./agent";
import { createApiClient } from "./api-client";
import {
  DEFAULT_OLLAMA_END_POINT,
  DEFAUTL_PROMPT,
  DEFAULT_OPENAI_CONFIG,
  DEFAULT_CLAUDE_CONFIG,
  DEFAULT_OPENAPI_CONFIG,
} from "../../constants";

export type GenerateReviewParams = {
  diff: string;
  language?: string;
  context?: string;
};

async function loadSettings() {
  try {
    const data = await browser.storage.local.get("settings");
    return data?.settings ?? {};
  } catch (e) {
    console.warn("读取设置失败，使用默认配置:", e);
    return {} as any;
  }
}

function renderTemplate(tpl: string, values: Record<string, string>) {
  return tpl
    .replace(/\{\{\s*context\s*\}\}/g, values.context ?? "")
    .replace(/\{\s*language\s*\}\}/g, values.language ?? "")
    .replace(/\{\{\s*diff\s*\}\}/g, values.diff ?? "");
}

export async function generateReview(
  params: GenerateReviewParams
): Promise<string> {
  const settings: any = await loadSettings();

  const current = settings?.aiAgent?.current ?? "ollama";
  const tplFromSettings = (settings?.prompt?.template ?? "").trim();
  const template: string = tplFromSettings ? tplFromSettings : DEFAUTL_PROMPT;
  const prompt = renderTemplate(template, {
    context: params.context ?? "",
    language: params.language ?? "",
    diff: params.diff,
  });

  switch (current) {
    case "ollama": {
      const endpoint: string =
        settings?.aiAgent?.aiAgentConfig?.ollama?.endpoint ??
        DEFAULT_OLLAMA_END_POINT;
      const model: string =
        settings?.aiAgent?.aiAgentConfig?.ollama?.model ?? "";
      if (!model) {
        throw new Error("未配置 Ollama 模型，请前往设置页选择模型");
      }
      // use stream mode to reduce timeout risk on long generations
      const text = await generateWithAgent({
        endpoint,
        model,
        prompt,
        stream: true,
        timeoutMs: 120000,
      });
      return (text ?? "").toString();
    }

    case "openai": {
      const config = settings?.aiAgent?.aiAgentConfig?.openai ?? {};
      const apiKey = config.apiKey;
      if (!apiKey) {
        throw new Error("未配置 OpenAI API Key，请前往设置页配置");
      }

      const apiConfig = {
        apiKey,
        baseUrl: config.baseUrl || DEFAULT_OPENAI_CONFIG.baseUrl,
        model: config.model || DEFAULT_OPENAI_CONFIG.model,
        timeoutMs: config.timeoutMs || DEFAULT_OPENAI_CONFIG.timeoutMs,
      };

      const client = createApiClient("openai", apiConfig);
      const response = await client.generate({
        prompt,
        config: apiConfig,
        stream: false,
        options: {
          temperature: 0.3,
          max_tokens: 1000,
        },
      });

      return response.content;
    }

    case "claude": {
      const config = settings?.aiAgent?.aiAgentConfig?.claude ?? {};
      const apiKey = config.apiKey;
      if (!apiKey) {
        throw new Error("未配置 Claude API Key，请前往设置页配置");
      }

      const apiConfig = {
        apiKey,
        baseUrl: config.baseUrl || DEFAULT_CLAUDE_CONFIG.baseUrl,
        model: config.model || DEFAULT_CLAUDE_CONFIG.model,
        timeoutMs: config.timeoutMs || DEFAULT_CLAUDE_CONFIG.timeoutMs,
      };

      const client = createApiClient("claude", apiConfig);
      const response = await client.generate({
        prompt,
        config: apiConfig,
        stream: false,
        options: {
          max_tokens: 1000,
        },
      });

      return response.content;
    }

    case "openapi": {
      const config = settings?.aiAgent?.aiAgentConfig?.openapi ?? {};
      const baseUrl = config.baseUrl;
      if (!baseUrl) {
        throw new Error("未配置 OpenAPI 兼容服务地址，请前往设置页配置");
      }

      const apiConfig = {
        apiKey: config.apiKey || "", // OpenAPI 兼容服务可能不需要 API Key
        baseUrl: config.baseUrl || DEFAULT_OPENAPI_CONFIG.baseUrl,
        model: config.model || DEFAULT_OPENAPI_CONFIG.model,
        timeoutMs: config.timeoutMs || DEFAULT_OPENAPI_CONFIG.timeoutMs,
        // 添加高级配置选项
        customHeaders: config.customHeaders || {},
        customParams: config.customParams || {},
        requestMethod:
          config.requestMethod || DEFAULT_OPENAPI_CONFIG.requestMethod,
        contentType: config.contentType || DEFAULT_OPENAPI_CONFIG.contentType,
        authType: config.authType || DEFAULT_OPENAPI_CONFIG.authType,
        authHeaderName:
          config.authHeaderName || DEFAULT_OPENAPI_CONFIG.authHeaderName,
        authQueryName:
          config.authQueryName || DEFAULT_OPENAPI_CONFIG.authQueryName,
      };

      const client = createApiClient("openapi", apiConfig);
      const response = await client.generate({
        prompt,
        config: apiConfig,
        stream: false,
        options: {
          temperature: 0.3,
          max_tokens: 1000,
        },
      });

      return response.content;
    }

    default:
      throw new Error(`不支持的AI代理类型: ${current}`);
  }
}

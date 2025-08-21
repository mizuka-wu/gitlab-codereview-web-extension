// 通用API客户端，支持多种AI服务
export interface ApiClientConfig {
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

export interface GenerateWithApiOptions {
  prompt: string;
  config: ApiClientConfig;
  stream?: boolean;
  options?: Record<string, any>;
}

export interface ApiResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// 通用OpenAPI兼容客户端
export class OpenAPICompatibleClient {
  async generate(opts: GenerateWithApiOptions): Promise<ApiResponse> {
    const { prompt, config, stream = false, options = {} } = opts;
    const controller = new AbortController();
    let timeout: any;
    
    const setupTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 60000);
    };
    setupTimeout();

    try {
      const baseUrl = config.baseUrl || '';
      if (!baseUrl) {
        throw new Error('未配置服务地址');
      }

      // 尝试多种可能的API端点
      const endpoints = [
        '/v1/chat/completions',  // OpenAI 格式
        '/chat/completions',      // 简化路径
        '/v1/completions',        // 旧版格式
        '/completions',           // 简化路径
        '/api/chat',              // 自定义格式
        '/api/generate',          // 生成格式
        '/generate'               // 直接生成
      ];

      let lastError: Error | null = null;
      
      for (const endpoint of endpoints) {
        try {
          const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
          const response = await this.tryEndpoint(url, prompt, config, stream, options, controller, setupTimeout);
          return response;
        } catch (error) {
          lastError = error as Error;
          console.warn(`尝试端点 ${endpoint} 失败:`, error);
          continue;
        }
      }

      throw lastError || new Error('所有API端点都尝试失败');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('API 请求超时');
      }
      throw err;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async tryEndpoint(
    url: string, 
    prompt: string, 
    config: ApiClientConfig, 
    stream: boolean, 
    options: Record<string, any>,
    controller: AbortController,
    setupTimeout: () => void
  ): Promise<ApiResponse> {
    // 尝试多种请求格式
    const requestFormats = [
      // OpenAI 格式
      {
        body: {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          stream: stream,
          ...options,
          ...config.customParams
        },
        headers: this.buildHeaders(config),
        method: config.requestMethod || 'POST'
      },
      // 简化格式
      {
        body: {
          model: config.model,
          prompt: prompt,
          stream: stream,
          ...options,
          ...config.customParams
        },
        headers: this.buildHeaders(config),
        method: config.requestMethod || 'POST'
      },
      // 无认证格式
      {
        body: {
          model: config.model,
          prompt: prompt,
          stream: stream,
          ...options,
          ...config.customParams
        },
        headers: this.buildHeaders(config, false),
        method: config.requestMethod || 'POST'
      }
    ];

    let lastError: Error | null = null;

    for (const format of requestFormats) {
      try {
        const res = await fetch(url, {
          method: format.method,
          headers: format.headers,
          body: JSON.stringify(format.body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`API 请求失败: ${res.status} ${res.statusText} ${text ? '- ' + text : ''}`);
        }

        if (stream) {
          return this.handleStreamResponse(res, setupTimeout);
        } else {
          const data = await res.json();
          return this.parseResponse(data);
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`尝试请求格式失败:`, format, error);
        continue;
      }
    }

    throw lastError || new Error('所有请求格式都尝试失败');
  }

  private buildHeaders(config: ApiClientConfig, includeAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // 设置内容类型
    headers['Content-Type'] = config.contentType || 'application/json';
    
    // 添加自定义headers
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }
    
    // 添加认证信息
    if (includeAuth && config.apiKey) {
      const authType = config.authType || 'bearer';
      const authHeaderName = config.authHeaderName || 'Authorization';
      const authQueryName = config.authQueryName || 'token';
      
      switch (authType) {
        case 'bearer':
          headers[authHeaderName] = `Bearer ${config.apiKey}`;
          break;
        case 'header':
          headers[authHeaderName] = config.apiKey;
          break;
        case 'query':
          // 查询参数在URL中处理
          break;
        case 'none':
          // 不添加认证
          break;
      }
    }
    
    return headers;
  }

  private parseResponse(data: any): ApiResponse {
    // 尝试多种响应格式
    let content = '';
    let usage = undefined;

    // OpenAI 格式
    if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
      usage = data.usage;
    }
    // 简化格式
    else if (data.response) {
      content = data.response;
    }
    // 直接文本
    else if (data.text) {
      content = data.text;
    }
    // 内容数组
    else if (data.content?.[0]?.text) {
      content = data.content[0].text;
    }
    // 回退到原始数据
    else {
      content = JSON.stringify(data);
    }

    return { content, usage };
  }

  private async handleStreamResponse(res: Response, setupTimeout: () => void): Promise<ApiResponse> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式读取 Response。');

    let result = '';
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setupTimeout();
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line || line === 'data: [DONE]') continue;
        
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            // 尝试多种流式响应格式
            const content = data.choices?.[0]?.delta?.content || 
                           data.delta?.content || 
                           data.content || 
                           data.text || 
                           '';
            if (content) result += content;
          } catch {
            // ignore malformed line
          }
        }
      }
    }

    return { content: result };
  }
}

// OpenAI API 客户端
export class OpenAIClient {
  async generate(opts: GenerateWithApiOptions): Promise<ApiResponse> {
    const { prompt, config, stream = false, options = {} } = opts;
    const controller = new AbortController();
    let timeout: any;
    
    const setupTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 60000);
    };
    setupTimeout();

    try {
      const baseUrl = config.baseUrl || 'https://api.openai.com';
      const url = `${baseUrl}/v1/chat/completions`;
      
      const body: any = {
        model: config.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: stream,
        ...options
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OpenAI API 请求失败: ${res.status} ${res.statusText} ${text ? '- ' + text : ''}`);
      }

      if (stream) {
        return this.handleStreamResponse(res, setupTimeout);
      } else {
        const data = await res.json();
        return {
          content: data.choices?.[0]?.message?.content || '',
          usage: data.usage
        };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('OpenAI API 请求超时');
      }
      throw err;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async handleStreamResponse(res: Response, setupTimeout: () => void): Promise<ApiResponse> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式读取 Response。');

    let result = '';
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setupTimeout();
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line || line === 'data: [DONE]') continue;
        
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) result += content;
          } catch {
            // ignore malformed line
          }
        }
      }
    }

    return { content: result };
  }
}

// Claude API 客户端
export class ClaudeClient {
  async generate(opts: GenerateWithApiOptions): Promise<ApiResponse> {
    const { prompt, config, stream = false, options = {} } = opts;
    const controller = new AbortController();
    let timeout: any;
    
    const setupTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 60000);
    };
    setupTimeout();

    try {
      const baseUrl = config.baseUrl || 'https://api.anthropic.com';
      const url = `${baseUrl}/v1/messages`;
      
      const body: any = {
        model: config.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: stream,
        max_tokens: options.maxTokens || 4000,
        ...options
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Claude API 请求失败: ${res.status} ${res.statusText} ${text ? '- ' + text : ''}`);
      }

      if (stream) {
        return this.handleStreamResponse(res, setupTimeout);
      } else {
        const data = await res.json();
        return {
          content: data.content?.[0]?.text || '',
          usage: data.usage
        };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Claude API 请求超时');
      }
      throw err;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async handleStreamResponse(res: Response, setupTimeout: () => void): Promise<ApiResponse> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式读取 Response。');

    let result = '';
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setupTimeout();
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line || line === 'data: [DONE]') continue;
        
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.content?.[0]?.delta?.text;
            if (content) result += content;
          } catch {
            // ignore malformed line
          }
        }
      }
    }

    return { content: result };
  }
}

// 通用API客户端工厂
export function createApiClient(type: string, config: ApiClientConfig) {
  switch (type) {
    case 'openai':
      return new OpenAIClient();
    case 'claude':
      return new ClaudeClient();
    case 'openapi':
      return new OpenAPICompatibleClient();
    default:
      throw new Error(`不支持的API类型: ${type}`);
  }
}

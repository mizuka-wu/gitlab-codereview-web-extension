// Ollama client implementation
// Supports both non-stream and stream (NDJSON) modes for /api/generate

export type GenerateWithOllamaOptions = {
  endpoint: string;
  model: string;
  prompt: string;
  stream?: boolean; // default false
  options?: Record<string, any>;
  timeoutMs?: number; // default 30000
};

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/$/, '');
}

export async function generateWithOllama(opts: GenerateWithOllamaOptions): Promise<string> {
  const endpoint = normalizeEndpoint(opts.endpoint || 'http://localhost:11434');
  const url = `${endpoint}/api/generate`;
  const controller = new AbortController();
  // For streaming, the timeout is treated as idle-timeout and will be reset on each chunk
  let timeout: any;
  const setupTimeout = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);
  };
  setupTimeout();

  try {
    const body: any = {
      model: opts.model || 'llama3',
      prompt: opts.prompt,
      stream: opts.stream ?? false,
    };
    if (opts.options) body.options = opts.options;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama 请求失败: ${res.status} ${res.statusText} ${text ? '- ' + text : ''}`);
    }

    // If stream mode, parse NDJSON chunks and accumulate
    if (body.stream) {
      const reader = res.body?.getReader();
      if (!reader) throw new Error('浏览器不支持流式读取 Response。');

      let result = '';
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setupTimeout(); // reset idle-timeout on each chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            if (typeof obj?.response === 'string') result += obj.response;
            // Ollama sends done=true when finished
            if (obj?.done) {
              return result;
            }
          } catch {
            // ignore malformed line; continue
          }
        }
      }

      // Flush remaining buffer (in case last line has no trailing newline)
      const rest = buffer.trim();
      if (rest) {
        try {
          const obj = JSON.parse(rest);
          if (typeof obj?.response === 'string') result += obj.response;
        } catch {
          // ignore
        }
      }
      return result;
    }

    // With stream=false, Ollama returns a single JSON object
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (typeof data?.response === 'string') return data.response;
      // Fallback if structure changes
      return JSON.stringify(data);
    }

    // Fallback: try text and parse
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (typeof json?.response === 'string') return json.response;
      return text;
    } catch {
      return text;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Ollama 请求超时');
    }
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Ollama client implementation
// Calls Ollama /api/generate with stream=false and returns the response text

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
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);

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
    clearTimeout(timeout);
  }
}

import browser from 'webextension-polyfill';
import { generateWithOllama } from './ollama';
import { DEFAULT_OLLAMA_END_POINT, DEFAUTL_PROMPT } from '../../constants';

export type GenerateReviewParams = {
  diff: string;
  language?: string;
  context?: string;
};

async function loadSettings() {
  try {
    const data = await browser.storage.sync.get('settings');
    return data?.settings ?? {};
  } catch (e) {
    console.warn('读取设置失败，使用默认配置:', e);
    return {} as any;
  }
}

function renderTemplate(tpl: string, values: Record<string, string>) {
  return tpl
    .replace(/\{\{\s*context\s*\}\}/g, values.context ?? '')
    .replace(/\{\{\s*language\s*\}\}/g, values.language ?? '')
    .replace(/\{\{\s*diff\s*\}\}/g, values.diff ?? '');
}

export async function generateReview(params: GenerateReviewParams): Promise<string> {
  const settings: any = await loadSettings();

  const current = settings?.aiAgent?.current ?? 'ollama';
  const template: string = settings?.prompt?.template ?? DEFAUTL_PROMPT;
  const prompt = renderTemplate(template, {
    context: params.context ?? '',
    language: params.language ?? '',
    diff: params.diff,
  });

  switch (current) {
    case 'ollama':
    default: {
      const endpoint: string = settings?.aiAgent?.aiAgentConfig?.ollama?.endpoint ?? DEFAULT_OLLAMA_END_POINT;
      const model: string = settings?.aiAgent?.aiAgentConfig?.ollama?.model ?? 'llama3';
      const text = await generateWithOllama({ endpoint, model, prompt, stream: false });
      return (text ?? '').toString();
    }
  }
}

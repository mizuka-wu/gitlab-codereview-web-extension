/**
 * 公共审查文本处理工具
 * - stripThinkTags: 移除大模型输出中的 <think>...</think>
 * - isNoSuggestionMessage: 判断文本是否为“无修改建议 / LGTM / 通过”等无须创建讨论的短回复
 */

/**
 * 去除大模型思考标签
 */
export function stripThinkTags(input: string): string {
  if (!input) return '';
  try {
    return input.replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '').trim();
  } catch {
    return input;
  }
}

/**
 * 判定是否为“无建议/通过”的简短回复
 * 规则：
 * 1) 统一大小写与空白后进行匹配；
 * 2) 支持常见英文/中文表达与变体（含标点/emoji/感叹号）；
 * 3) 仅当文本较短（<= 120 字符）且匹配关键模式时返回 true，以减少误杀。
 */
export function isNoSuggestionMessage(input: string): boolean {
  const raw = (input || '').trim();
  if (!raw) return false;

  // 归一化：小写、去除多余符号并压缩空白
  const compact = raw.toLowerCase();
  const normalized = compact
    .replace(/[`*_~>[\](){}/#|]/g, ' ')
    .replace(/[\u2705\u270C\u270A\u270B\u1F44D\u1F44C\u1F44F]/g, ' ') // 常见emoji占位清理
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return false;
  if (normalized.length > 120) return false;

  const patterns: RegExp[] = [
    // 英文
    /\blgtm\b[\s,!.👍👌🙂]*$/i,
    /\blocks?\s+good(?:\s+to\s+me)?\b[\s,!.👍👌🙂]*$/i,
    /\b(no|without)\s+(suggestions?|issues?|problems?)\b/i,
    /\bnothing\s+to\s+(change|fix|comment)\b/i,
    /\b(looks|seems)\s+(fine|ok|okay|good)\b/i,
    /\b(approved|approve|ship\s*it)\b[\s,!.👍👌🙂]*$/i,

    // 中文
    /(无修改建议|无意见|没有问题|没有建议|没有修改建议|没有需要修改|无需修改)/i,
    /(看起来没问题|看起来不错|看上去没问题|看上去不错)/i,
    /(通过|已通过|审核通过|审查通过|已审阅[，,、 ]?无修改)/i,
  ];

  return patterns.some((p) => p.test(normalized));
}

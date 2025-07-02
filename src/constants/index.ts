/**
 * @todo 一些默认参数的区域
 */

export const DEFAULT_OLLAMA_END_POINT = "http://localhost:11434";

export const DEFAUTL_PROMPT =
  "请对以下 GitLab 代码变更进行简要的代码审查，如果有任何 bug 风险和改进建议，请提出来：\n\n" +
  "{{context}}\n" +
  "编程语言：{{language}}\n\n" +
  "{{diff}}\n\n" +
  "请提供简洁的分析，包括：\n" +
  "1. 代码质量和最佳实践\n" +
  "2. 潜在的 bug 或安全问题\n" +
  "3. 性能考虑\n" +
  "4. 可维护性和可读性\n\n" +
  "请确保回复简洁明了，每个要点不超过100字。总体回复不要超过500字。";

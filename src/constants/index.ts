/**
 * @todo 一些默认参数的区域
 */
export const AiAgents = ["ollama", "openai", "claude", "openapi"] as const;

export const DEFAULT_OLLAMA_END_POINT = "http://localhost:11434";

// 默认API配置
export const DEFAULT_OPENAI_CONFIG = {
  baseUrl: "https://api.openai.com",
  model: "gpt-3.5-turbo",
  timeoutMs: 60000
};

export const DEFAULT_CLAUDE_CONFIG = {
  baseUrl: "https://api.anthropic.com",
  model: "claude-3-haiku-20240307",
  timeoutMs: 60000
};

export const DEFAULT_OPENAPI_CONFIG = {
  baseUrl: "http://localhost:8000",
  model: "default",
  timeoutMs: 60000,
  customHeaders: {},
  customParams: {},
  requestMethod: "POST" as const,
  contentType: "application/json",
  authType: "bearer" as const,
  authHeaderName: "Authorization",
  authQueryName: "token"
};

export const DEFAUTL_PROMPT =
  "你是代码审查助手。你将同时收到两个输入：\n" +
  "1) 文件上下文（context）：用于理解文件整体结构、命名与依赖，通常为目标提交的原始内容，可能为空；\n" +
  "2) 变更补丁（diff）：以 unified diff 格式展示的实际改动。\n" +
  "评审要求：以 diff 中的改动为唯一评审对象，必要时借助 context 理解语义；当 context 与 diff 有冲突时，以 diff 为准；若 context 为空，仅基于 diff 评审。\n\n" +
  "【文件上下文（context，非必填；不要对仅出现在 context 的旧代码提出意见）】\n" +
  "{{context}}\n\n" +
  "编程语言：{{language}}\n\n" +
  "【变更补丁（diff；仅其中的新增/删除行及其必要上下文为评审范围）】\n" +
  "{{diff}}\n\n" +
  "审查规则：\n" +
  "1. 仅评审修改/新增的行及其必要上下文；与改动无关的旧代码忽略（除非其与改动存在直接因果关系并需明确指出）。\n" +
  "2. 仅当存在以下问题才提出建议：功能错误、潜在 bug、安全风险、明显性能退化、与项目既有规范冲突、可读性严重下降。\n" +
  "3. 对纯风格偏好、命名口味、轻微优化等不要提出建议，除非违反既有规范。\n\n" +
  "输出要求：\n" +
  "• 若无问题：只回复“LGTM（无修改建议）”。\n" +
  "• 若有问题：先给出“结论：发现N项问题”，随后逐项列出，格式：\n" +
  "  - [高/中/低] 位置：文件路径与大致行号/片段\n" +
  "  - 原因：问题简述\n" +
  "  - 建议：可执行的修改方案\n\n" +
  "字数限制：总字数≤500字；每个要点≤100字；避免重复。";

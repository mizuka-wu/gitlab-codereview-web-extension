# GitLab 代码审查扩展 - API 使用说明

## 概述

本扩展现在支持多种 AI 服务，除了本地 Ollama 之外，还可以使用 OpenAI 和 Claude 的 API 服务。

## 支持的 AI 服务

### 1. Ollama (本地)
- **类型**: 本地部署的 AI 模型
- **优势**: 免费、隐私安全、可自定义模型
- **配置**: 需要本地运行 Ollama 服务

### 2. OpenAI API
- **类型**: 云端 AI 服务
- **优势**: 模型质量高、响应速度快、稳定可靠
- **配置**: 需要 OpenAI API Key
- **支持模型**: GPT-3.5 Turbo、GPT-4、GPT-4o 等

### 3. Claude API
- **类型**: Anthropic 的 AI 服务
- **优势**: 代码理解能力强、安全性高
- **配置**: 需要 Claude API Key
- **支持模型**: Claude 3 Haiku、Claude 3.5 Sonnet 等

### 4. OpenAPI 兼容服务
- **类型**: 自定义部署的 AI 服务
- **优势**: 完全控制、可自定义、支持多种开源模型
- **配置**: 需要服务地址，API Key 可选
- **支持模型**: 取决于部署的服务（如 Llama、Mistral、Qwen 等）
- **兼容性**: 自动尝试多种 API 格式和端点

## 配置说明

### OpenAI 配置
1. 在扩展设置页面选择 "OpenAI" 作为 AI 代理
2. 输入你的 OpenAI API Key
3. 可选择自定义基础 URL（默认: https://api.openai.com）
4. 选择模型（推荐: gpt-3.5-turbo 或 gpt-4o）
5. 设置超时时间（默认: 60000ms）

### Claude 配置
1. 在扩展设置页面选择 "Claude" 作为 AI 代理
2. 输入你的 Claude API Key
3. 可选择自定义基础 URL（默认: `https://api.anthropic.com`）
4. 选择模型（推荐: `claude-3-haiku-20240307`）
5. 设置超时时间（默认: 60000ms）

### OpenAPI 兼容服务配置
1. 在扩展设置页面选择 "OpenAPI 兼容服务" 作为 AI 代理
2. 输入你的 API Key（如果服务需要的话，否则留空）
3. 输入服务地址（如: `http://localhost:8000` 或 `https://your-api.com`）
4. 输入模型名称（如: `llama2`、`mistral`、`qwen` 等）
5. 设置超时时间（默认: 60000ms）

#### 高级配置选项
点击"高级设置"可以配置更多选项：

- **认证类型**: 选择 Bearer Token、API Key 或无认证
- **认证Header名称**: 自定义认证Header的名称（默认: Authorization）
- **请求方法**: 选择 HTTP 请求方法（默认: POST）
- **内容类型**: 设置请求的 Content-Type（默认: application/json）
- **自定义Headers**: 添加额外的HTTP头（JSON格式）
- **自定义请求参数**: 添加额外的请求参数（JSON格式）

#### 自定义Headers示例
```json
{
  "User-Agent": "MyApp/1.0",
  "X-API-Version": "v2",
  "X-Custom-Header": "custom-value"
}
```

#### 自定义请求参数示例
```json
{
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 0.9,
  "frequency_penalty": 0.1
}
```

#### 支持的 OpenAPI 兼容服务
- **Ollama** (除了本地模式外，也支持远程部署)
- **vLLM** (高性能推理服务)
- **Text Generation WebUI** (Web 界面)
- **OpenAI 兼容的 API 服务**
- **自定义部署的开源模型服务**

## 获取 API Key

### OpenAI API Key
1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 注册或登录账户
3. 在 API Keys 页面创建新的 API Key
4. 复制并保存 API Key

### Claude API Key
1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册或登录账户
3. 在 API Keys 页面创建新的 API Key
4. 复制并保存 API Key

## 使用建议

### 选择建议
- **开发环境**: 推荐使用 Ollama，免费且隐私安全
- **生产环境**: 推荐使用 OpenAI 或 Claude，稳定性和质量更高
- **代码审查**: Claude 在代码理解方面表现优秀
- **通用任务**: OpenAI 在多种任务上表现均衡
- **自定义部署**: OpenAPI 兼容服务适合有技术能力的用户
- **开源模型**: 通过 OpenAPI 兼容服务可以使用最新的开源模型

### 成本考虑
- **Ollama**: 免费（仅硬件成本）
- **OpenAI**: 按 token 计费，GPT-3.5 相对便宜
- **Claude**: 按 token 计费，Haiku 模型性价比高
- **OpenAPI 兼容服务**: 取决于部署方式，自托管通常成本较低

### 隐私考虑
- **Ollama**: 所有数据都在本地，完全私密
- **OpenAI/Claude**: 数据会发送到云端，注意敏感信息
- **OpenAPI 兼容服务**: 取决于部署位置，自托管完全私密

## 故障排除

### 常见问题

1. **API Key 无效**
   - 检查 API Key 是否正确复制
   - 确认账户是否有足够的配额

2. **请求超时**
   - 增加超时时间设置
   - 检查网络连接
   - 确认 API 服务状态

3. **模型不可用**
   - 检查模型名称是否正确
   - 确认账户是否有权限访问该模型

4. **配额不足**
   - 检查 API 使用量
   - 考虑升级账户或使用其他服务

5. **OpenAPI 兼容服务连接失败**
   - 检查服务地址是否正确
   - 确认服务是否正在运行
   - 检查防火墙和网络设置
   - 尝试不同的 API 端点

## 安全注意事项

1. **API Key 安全**
   - 不要在公共场所暴露 API Key
   - 定期轮换 API Key
   - 使用环境变量存储（如果可能）

2. **数据隐私**
   - 避免发送敏感代码到第三方服务
   - 了解各服务的隐私政策
   - 考虑使用本地服务处理敏感数据

## 部署示例

### 使用 Ollama 作为远程服务
```bash
# 启动 Ollama 服务
ollama serve

# 在另一个终端拉取模型
ollama pull llama2

# 配置扩展
# AI 代理: OpenAPI 兼容服务
# 服务地址: http://your-server:11434
# 模型名称: llama2
```

### 使用 vLLM 部署
```bash
# 安装 vLLM
pip install vllm

# 启动服务
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-chat-hf \
    --host 0.0.0.0 \
    --port 8000

# 配置扩展
# AI 代理: OpenAPI 兼容服务
# 服务地址: http://localhost:8000
# 模型名称: meta-llama/Llama-2-7b-chat-hf
```

### 使用 Text Generation WebUI
```bash
# 克隆仓库
git clone https://github.com/oobabooga/text-generation-webui
cd text-generation-webui

# 启动 API 服务
python server.py --api --listen --port 7860

# 配置扩展
# AI 代理: OpenAPI 兼容服务
# 服务地址: http://localhost:7860
# 模型名称: 你的模型名称
```

## 更新日志

- **v1.1.0**: 新增多种AI代理支持
  - 新增 OpenAI API 支持
  - 新增 Claude API 支持  
  - 新增 OpenAPI 兼容服务支持
  - 新增高级配置选项（自定义headers、参数、认证等）
  - 改进的国际化支持
  - 优化的AI代理架构
- **v1.0.0**: 初始版本，仅支持 Ollama

## 技术支持

如果遇到问题，请：
1. 检查配置是否正确
2. 查看浏览器控制台错误信息
3. 确认网络连接正常
4. 联系开发者或提交 Issue

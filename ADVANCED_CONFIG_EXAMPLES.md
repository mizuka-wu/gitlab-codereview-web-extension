# OpenAPI 兼容服务高级配置示例

本文档提供了各种 OpenAPI 兼容服务的高级配置示例，帮助你充分利用自定义配置功能。

## 1. 基础配置示例

### 简单的 Ollama 远程服务
```json
{
  "apiKey": "",
  "baseUrl": "http://192.168.1.100:11434",
  "model": "llama2",
  "timeoutMs": 60000,
  "authType": "none",
  "requestMethod": "POST",
  "contentType": "application/json"
}
```

### 带认证的 API 服务
```json
{
  "apiKey": "your-secret-key",
  "baseUrl": "https://api.yourcompany.com",
  "model": "gpt-4",
  "timeoutMs": 60000,
  "authType": "bearer",
  "authHeaderName": "X-API-Key",
  "requestMethod": "POST",
  "contentType": "application/json"
}
```

## 2. 自定义 Headers 配置

### 添加版本控制
```json
{
  "customHeaders": {
    "X-API-Version": "v2.1",
    "X-Client-ID": "my-extension",
    "User-Agent": "GitLabCodeReview/2.0"
  }
}
```

### 添加追踪信息
```json
{
  "customHeaders": {
    "X-Request-ID": "{{uuid}}",
    "X-Session-ID": "{{session}}",
    "X-User-ID": "{{user}}"
  }
}
```

### 添加业务逻辑头
```json
{
  "customHeaders": {
    "X-Environment": "production",
    "X-Region": "us-west-1",
    "X-Feature-Flags": "advanced-review,code-analysis"
  }
}
```

## 3. 自定义请求参数配置

### OpenAI 兼容参数
```json
{
  "customParams": {
    "temperature": 0.3,
    "max_tokens": 1500,
    "top_p": 0.9,
    "frequency_penalty": 0.1,
    "presence_penalty": 0.1,
    "stop": ["\n\n", "Human:", "Assistant:"]
  }
}
```

### 自定义模型参数
```json
{
  "customParams": {
    "temperature": 0.7,
    "max_new_tokens": 1000,
    "do_sample": true,
    "top_k": 50,
    "top_p": 0.95,
    "repetition_penalty": 1.1
  }
}
```

### 业务特定参数
```json
{
  "customParams": {
    "temperature": 0.2,
    "max_tokens": 800,
    "system_prompt": "你是一个专业的代码审查专家",
    "review_style": "detailed",
    "focus_areas": ["security", "performance", "maintainability"]
  }
}
```

## 4. 不同认证类型配置

### Bearer Token 认证
```json
{
  "authType": "bearer",
  "authHeaderName": "Authorization",
  "apiKey": "your-bearer-token"
}
```

### 自定义 Header 认证
```json
{
  "authType": "header",
  "authHeaderName": "X-API-Key",
  "apiKey": "your-api-key"
}
```

### 无认证
```json
{
  "authType": "none",
  "apiKey": ""
}
```

### 查询参数认证
```json
{
  "authType": "query",
  "authQueryName": "access_token",
  "apiKey": "your-access-token"
}
```

## 5. 不同内容类型配置

### JSON 格式（默认）
```json
{
  "contentType": "application/json"
}
```

### 表单数据
```json
{
  "contentType": "application/x-www-form-urlencoded"
}
```

### 纯文本
```json
{
  "contentType": "text/plain"
}
```

### 自定义 MIME 类型
```json
{
  "contentType": "application/vnd.company.v1+json"
}
```

## 6. 完整配置示例

### 企业级 API 服务
```json
{
  "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "baseUrl": "https://ai-api.company.com",
  "model": "gpt-4-enterprise",
  "timeoutMs": 120000,
  "authType": "bearer",
  "authHeaderName": "Authorization",
  "requestMethod": "POST",
  "contentType": "application/json",
  "customHeaders": {
    "X-API-Version": "v3.0",
    "X-Client-ID": "gitlab-extension",
    "X-Environment": "production",
    "X-Region": "us-east-1",
    "User-Agent": "GitLabCodeReview/2.1.0"
  },
  "customParams": {
    "temperature": 0.2,
    "max_tokens": 2000,
    "top_p": 0.9,
    "frequency_penalty": 0.1,
    "presence_penalty": 0.1,
    "system_prompt": "你是一个资深的软件工程师和代码审查专家，专注于代码质量、安全性和最佳实践。"
  }
}
```

### 本地开源模型服务
```json
{
  "apiKey": "",
  "baseUrl": "http://localhost:8000",
  "model": "llama2-13b-chat",
  "timeoutMs": 180000,
  "authType": "none",
  "requestMethod": "POST",
  "contentType": "application/json",
  "customHeaders": {
    "User-Agent": "GitLabCodeReview/2.1.0"
  },
  "customParams": {
    "temperature": 0.3,
    "max_new_tokens": 1500,
    "do_sample": true,
    "top_k": 40,
    "top_p": 0.9,
    "repetition_penalty": 1.1,
    "stop": ["Human:", "Assistant:", "\n\n"]
  }
}
```

### 云服务提供商
```json
{
  "apiKey": "sk-1234567890abcdef...",
  "baseUrl": "https://api.cloud-ai.com",
  "model": "claude-3-sonnet",
  "timeoutMs": 90000,
  "authType": "bearer",
  "authHeaderName": "X-API-Key",
  "requestMethod": "POST",
  "contentType": "application/json",
  "customHeaders": {
    "X-Provider": "cloud-ai",
    "X-Service": "code-review",
    "X-Client-Version": "2.1.0"
  },
  "customParams": {
    "max_tokens": 1000,
    "temperature": 0.1,
    "system": "你是一个专业的代码审查助手，请提供详细的分析和建议。"
  }
}
```

## 7. 配置验证和测试

### 配置检查清单
- [ ] 服务地址是否正确
- [ ] 模型名称是否存在
- [ ] API Key 是否有效
- [ ] 认证类型是否匹配
- [ ] 自定义参数格式是否正确
- [ ] 超时时间是否合理

### 测试连接
使用扩展中的"测试连接"功能验证配置：
1. 确保所有必填字段已填写
2. 点击"测试连接"按钮
3. 查看测试结果和错误信息
4. 根据错误信息调整配置

### 常见错误和解决方案

#### 连接被拒绝
- 检查服务地址和端口
- 确认服务是否正在运行
- 检查防火墙设置

#### 认证失败
- 验证 API Key 是否正确
- 检查认证类型设置
- 确认认证Header名称

#### 模型不存在
- 检查模型名称拼写
- 确认模型是否已部署
- 查看服务日志

#### 参数错误
- 检查 JSON 格式是否正确
- 确认参数名称是否有效
- 验证参数值范围

## 8. 性能优化建议

### 超时设置
- **本地服务**: 30-60秒
- **局域网服务**: 60-120秒
- **互联网服务**: 90-180秒

### 并发控制
- 避免同时发送过多请求
- 根据服务性能调整并发数
- 实现请求队列和重试机制

### 缓存策略
- 缓存模型响应结果
- 实现智能重试机制
- 使用本地存储保存配置

通过这些高级配置示例，你可以充分利用 OpenAPI 兼容服务的灵活性，为不同的 AI 服务定制最适合的配置，提升代码审查的质量和效率。

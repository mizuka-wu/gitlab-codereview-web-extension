# OpenAPI 兼容服务配置示例

本文档提供了各种 OpenAPI 兼容服务的配置示例，帮助你快速设置和使用自定义 AI 服务。

## 1. Ollama 远程服务

### 服务端配置
```bash
# 在服务器上启动 Ollama
ollama serve

# 拉取需要的模型
ollama pull llama2
ollama pull mistral
ollama pull qwen
```

### 扩展配置
- **AI 代理**: OpenAPI 兼容服务
- **API Key**: 留空（Ollama 不需要）
- **服务地址**: `http://your-server-ip:11434`
- **模型名称**: `llama2` 或 `mistral` 或 `qwen`
- **超时时间**: 60000ms

## 2. vLLM 服务

### 服务端配置
```bash
# 安装 vLLM
pip install vllm

# 启动 OpenAI 兼容的 API 服务
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-chat-hf \
    --host 0.0.0.0 \
    --port 8000 \
    --tensor-parallel-size 1

# 或者使用其他模型
python -m vllm.entrypoints.openai.api_server \
    --model mistralai/Mistral-7B-Instruct-v0.2 \
    --host 0.0.0.0 \
    --port 8000
```

### 扩展配置
- **AI 代理**: OpenAPI 兼容服务
- **API Key**: 留空（vLLM 不需要）
- **服务地址**: `http://localhost:8000`
- **模型名称**: `meta-llama/Llama-2-7b-chat-hf`
- **超时时间**: 60000ms

## 3. Text Generation WebUI

### 服务端配置
```bash
# 克隆仓库
git clone https://github.com/oobabooga/text-generation-webui
cd text-generation-webui

# 安装依赖
pip install -r requirements.txt

# 启动 API 服务
python server.py --api --listen --port 7860 --model your-model-name
```

### 扩展配置
- **AI 代理**: OpenAPI 兼容服务
- **API Key**: 留空（通常不需要）
- **服务地址**: `http://localhost:7860`
- **模型名称**: 你的模型名称
- **超时时间**: 60000ms

## 4. FastChat

### 服务端配置
```bash
# 安装 FastChat
pip install fschat

# 启动服务
python3 -m fastchat.serve.openai_api_server \
    --host 0.0.0.0 \
    --port 8000 \
    --model-path /path/to/your/model
```

### 扩展配置
- **AI 代理**: OpenAPI 兼容服务
- **API Key**: 留空（FastChat 不需要）
- **服务地址**: `http://localhost:8000`
- **模型名称**: 你的模型名称
- **超时时间**: 60000ms

## 5. 自定义 OpenAI 兼容服务

### 服务端配置
如果你有自己的 OpenAI 兼容服务，确保它支持以下端点之一：
- `/v1/chat/completions`
- `/chat/completions`
- `/v1/completions`
- `/completions`
- `/api/chat`
- `/api/generate`
- `/generate`

### 扩展配置
- **AI 代理**: OpenAPI 兼容服务
- **API Key**: 如果需要的话填写
- **服务地址**: 你的服务地址
- **模型名称**: 你的模型名称
- **超时时间**: 根据服务性能调整

## 6. Docker 部署示例

### Ollama Docker
```bash
# 拉取 Ollama 镜像
docker pull ollama/ollama

# 运行容器
docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama

# 进入容器拉取模型
docker exec -it ollama ollama pull llama2
```

### vLLM Docker
```bash
# 运行 vLLM 容器
docker run --gpus all -p 8000:8000 \
    -v /path/to/models:/models \
    vllm/vllm-openai \
    --model /models/llama2 \
    --host 0.0.0.0 \
    --port 8000
```

## 7. 故障排除

### 常见问题

1. **连接被拒绝**
   - 检查服务是否正在运行
   - 确认端口是否正确
   - 检查防火墙设置

2. **模型不存在**
   - 确认模型名称是否正确
   - 检查模型是否已下载/加载
   - 查看服务日志

3. **请求超时**
   - 增加超时时间设置
   - 检查网络连接
   - 确认服务性能

4. **API 格式不兼容**
   - 扩展会自动尝试多种格式
   - 检查服务是否支持 OpenAI 兼容格式
   - 查看服务文档

### 调试技巧

1. **查看服务日志**
   ```bash
   # Ollama
   ollama serve --verbose
   
   # vLLM
   python -m vllm.entrypoints.openai.api_server --model your-model --verbose
   ```

2. **测试 API 端点**
   ```bash
   curl -X POST http://localhost:8000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "your-model",
       "messages": [{"role": "user", "content": "Hello"}]
     }'
   ```

3. **检查网络连接**
   ```bash
   # 测试端口是否开放
   telnet localhost 8000
   
   # 或者使用 nc
   nc -zv localhost 8000
   ```

## 8. 性能优化建议

1. **模型选择**: 根据硬件配置选择合适的模型大小
2. **并发控制**: 调整服务的并发参数
3. **缓存策略**: 启用模型和结果缓存
4. **硬件加速**: 使用 GPU 加速推理
5. **网络优化**: 如果服务在远程，考虑使用 CDN 或优化网络路径

## 9. 安全注意事项

1. **访问控制**: 限制服务的访问范围
2. **API 密钥**: 如果服务支持，使用 API 密钥进行认证
3. **网络隔离**: 将服务部署在安全的网络环境中
4. **日志监控**: 监控服务的访问日志
5. **定期更新**: 保持服务软件的最新版本

通过这些配置示例，你可以轻松地将各种开源 AI 模型集成到你的代码审查工作流中，享受完全控制和隐私保护的优势。

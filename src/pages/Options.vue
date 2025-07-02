<template>
  <div class="options-container">
    <header class="header">
      <img src="/icon/active/128.png" class="logo" />
      <h1>GitLab 代码审查助手</h1>
    </header>

    <main class="main-content">
      <!-- 检测设置 -->
      <div class="settings-section">
        <h2>检测设置</h2>
        <div class="form-group">
          <label class="switch">
            <input type="checkbox" v-model="settings.detctor.isEnable">
            <span class="slider round"></span>
          </label>
          <span class="switch-label">启用页面检测</span>
        </div>
      </div>

      <!-- AI 代理设置 -->
      <div class="settings-section">
        <h2>AI 代理设置</h2>

        <div class="form-group">
          <label>AI 代理</label>
          <select v-model="settings.aiAgent.current" class="form-control">
            <option v-for="agent in AiAgents" :key="agent" :value="agent">
              {{ formatAgentName(agent) }}
            </option>
          </select>
        </div>

        <div v-if="settings.aiAgent.current === 'ollama'" class="ai-config">
          <div class="form-group">
            <label>Ollama 地址</label>
            <input type="text" v-model="settings.aiAgent.aiAgentConfig.ollama.endpoint"
              placeholder="http://localhost:11434" class="form-control" @input="ensureOllamaConfig()">
            <small class="form-text">Ollama 服务器地址</small>
          </div>

          <div class="form-group">
            <label>模型名称</label>
            <input type="text" v-model="settings.aiAgent.aiAgentConfig.ollama.model" placeholder="llama3"
              class="form-control" @input="ensureOllamaConfig()">
            <small class="form-text">要使用的模型名称</small>
          </div>
        </div>
      </div>

      <!-- 提示词设置 -->
      <div class="settings-section">
        <div class="section-header">
          <h2>提示词设置</h2>
          <button @click="resetPrompt" class="btn btn-sm btn-outline">恢复默认</button>
        </div>
        <div class="form-group">
          <textarea v-model="settings.prompt.template" class="form-control prompt-textarea" placeholder="请输入提示词模板"
            rows="10"></textarea>
        </div>
      </div>

      <!-- 保存按钮 -->
      <div class="actions">
        <button @click="saveSettings" class="btn btn-primary">保存设置</button>
        <span id="status" class="status-message"></span>
      </div>
    </main>
  </div>
</template>
<script lang="ts" setup>
import browser from "webextension-polyfill";
import { ref, onMounted } from 'vue';
import { DEFAUTL_PROMPT, AiAgents } from '../constants';
import type { Settings } from '../types';

const settings = ref<Settings>({
  detctor: {
    isEnable: true,
  },
  aiAgent: {
    current: 'ollama', // 使用 AiAgents 中的第一个值作为默认值
    aiAgentConfig: {
      ollama: {
        endpoint: '',
        model: '',
      },
    },
  },
  prompt: {
    template: '',
  },
});

// 确保 ollama 配置存在
const ensureOllamaConfig = () => {
  if (!settings.value.aiAgent.aiAgentConfig.ollama) {
    settings.value.aiAgent.aiAgentConfig.ollama = {
      endpoint: '',
      model: ''
    };
  }
};

// 加载保存的设置
const loadSettings = async () => {
  const result = await browser.storage.sync.get('settings');
  if (result.settings) {
    settings.value = {
      ...settings.value,
      ...result.settings,
      aiAgent: {
        ...settings.value.aiAgent,
        ...(result.settings.aiAgent || {}),
        aiAgentConfig: {
          ...(settings.value.aiAgent.aiAgentConfig || {}),
          ...(result.settings.aiAgent?.aiAgentConfig || {}),
        },
      },
    };
    ensureOllamaConfig();
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    await browser.storage.sync.set({ settings: settings.value });
    // 显示保存成功提示
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '设置已保存';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    }
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 重置为默认提示词
const resetPrompt = () => {
  if (confirm('确定要重置为默认提示词吗？')) {
    settings.value.prompt.template = DEFAUTL_PROMPT;
  }
};

// 格式化代理名称显示
const formatAgentName = (agent: string): string => {
  return agent.charAt(0).toUpperCase() + agent.slice(1);
};

// 组件挂载时加载设置
onMounted(() => {
  loadSettings();
});
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.5;
}

.options-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1.5rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header .logo {
  width: 64px;
  height: 64px;
  margin-bottom: 0.5rem;
}

.header h1 {
  font-size: 1.5rem;
  color: var(--text-color);
  margin: 0;
}

.settings-section {
  background: white;
  border-radius: var(--radius);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.25rem;
  color: var(--text-color);
  margin: 0 0 1rem 0;
}

.form-group {
  margin-bottom: 1.25rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-color);
}

.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--text-color);
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: var(--primary-color);
  outline: 0;
  box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.2);
}

.prompt-textarea {
  min-height: 200px;
  resize: vertical;
}

.form-text {
  display: block;
  margin-top: 0.25rem;
  color: #6b7280;
  font-size: 0.875rem;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  margin-right: 10px;
  vertical-align: middle;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked+.slider {
  background-color: var(--primary-color);
}

input:focus+.slider {
  box-shadow: 0 0 1px var(--primary-color);
}

input:checked+.slider:before {
  transform: translateX(26px);
}

.switch-label {
  vertical-align: middle;
  font-weight: normal;
}

/* 按钮样式 */
.btn {
  display: inline-block;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  user-select: none;
  border: 1px solid transparent;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  border-radius: 0.375rem;
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  cursor: pointer;
}

.btn-primary {
  color: #fff;
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background-color: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-outline {
  color: var(--primary-color);
  background-color: transparent;
  border: 1px solid var(--primary-color);
}

.btn-outline:hover {
  background-color: rgba(90, 103, 216, 0.1);
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.5;
  border-radius: 0.25rem;
}

/* 操作区域 */
.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.status-message {
  color: var(--success-color);
  font-size: 0.875rem;
  font-weight: 500;
  transition: opacity 0.3s ease;
}

/* 响应式调整 */
@media (max-width: 640px) {
  .options-container {
    padding: 1rem;
  }

  .settings-section {
    padding: 1rem;
  }
}
</style>

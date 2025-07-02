<template>
  <n-message-provider>
    <n-layout class="options-container">
      <n-layout-header class="header">
        <img src="/icon/active/128.png" class="logo" />
        <n-h1>GitLab 代码审查助手</n-h1>
      </n-layout-header>

      <n-layout-content class="main-content">
        <!-- 检测设置 -->
        <n-card title="检测设置" class="settings-section">
          <n-space vertical>
            <n-switch v-model:value="settings.detctor.isEnable" />
            <span>启用页面检测</span>
          </n-space>
        </n-card>

        <!-- AI 代理设置 -->
        <n-card title="AI 代理设置" class="settings-section">
          <n-space vertical>
            <n-form-item label="AI 代理">
              <n-select v-model:value="settings.aiAgent.current" :options="aiAgentOptions" style="width: 200px" />
            </n-form-item>

            <template v-if="settings.aiAgent.current === 'ollama'">
              <n-form-item label="Ollama 地址">
                <n-input v-model:value="settings.aiAgent.aiAgentConfig.ollama.endpoint"
                  placeholder="http://localhost:11434" @update:value="ensureOllamaConfig" />
                <template #suffix>
                  <n-text depth="3" style="font-size: 12px">Ollama 服务器地址</n-text>
                </template>
              </n-form-item>

              <n-form-item label="模型名称">
                <n-input v-model:value="settings.aiAgent.aiAgentConfig.ollama.model" placeholder="llama3"
                  @update:value="ensureOllamaConfig" />
                <template #suffix>
                  <n-text depth="3" style="font-size: 12px">要使用的模型名称</n-text>
                </template>
              </n-form-item>
            </template>
          </n-space>
        </n-card>

        <!-- 提示词设置 -->
        <n-card class="settings-section">
          <template #header>
            <n-space justify="space-between" align="center">
              <n-h2 style="margin: 0">提示词设置</n-h2>
              <n-button @click="resetPrompt" size="small" type="default">恢复默认</n-button>
            </n-space>
          </template>
          <n-input v-model:value="settings.prompt.template" type="textarea" placeholder="请输入提示词模板"
            :autosize="{ minRows: 10 }" />
        </n-card>

        <!-- 保存按钮 -->
        <n-space justify="end" class="actions">
          <n-button type="primary" @click="saveSettings">保存设置</n-button>
          <n-text v-if="saveStatus.message" :type="saveStatus.type">
            {{ saveStatus.message }}
          </n-text>
        </n-space>
      </n-layout-content>
    </n-layout>
  </n-message-provider>
</template>
<script lang="ts" setup>
import browser from "webextension-polyfill";
import { ref, onMounted, h } from 'vue';
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NCard,
  NSpace,
  NSwitch,
  NFormItem,
  NInput,
  NButton,
  NSelect,
  NText,
  NH1,
  NH2,
  NMessageProvider,
  useMessage
} from 'naive-ui';
import { DEFAUTL_PROMPT, AiAgents } from '../constants';
import type { Settings } from '../types';

const message = useMessage();
const saveStatus = ref({ message: '', type: 'success' });

const settings = ref<Settings>({
  detctor: {
    isEnable: true,
  },
  aiAgent: {
    current: 'ollama',
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

const aiAgentOptions = AiAgents.map(agent => ({
  label: formatAgentName(agent),
  value: agent
}));

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
    saveStatus.value = {
      message: '设置已保存',
      type: 'success'
    };
    message.success('设置已保存');
    setTimeout(() => {
      saveStatus.value.message = '';
    }, 2000);
  } catch (error) {
    console.error('保存设置失败:', error);
    saveStatus.value = {
      message: '保存失败，请重试',
      type: 'error'
    };
    message.error('保存失败，请重试');
  }
};

// 重置为默认提示词
const resetPrompt = () => {
  const d = window.$dialog.warning({
    title: '确认重置',
    content: '确定要重置为默认提示词吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      settings.value.prompt.template = DEFAUTL_PROMPT;
      message.success('已重置为默认提示词');
      d.destroy();
    }
  });
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

<style scoped>
.options-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
  min-height: 100vh;
  background-color: var(--n-color-embedded);
}

.header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--n-divider-color);
}

.header .logo {
  width: 64px;
  height: 64px;
  margin-bottom: 0.5rem;
}

.settings-section {
  margin-bottom: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
}

.actions {
  margin-top: 1.5rem;
  padding: 1rem 0;
  border-top: 1px solid var(--n-divider-color);
}

/* 响应式调整 */
@media (max-width: 640px) {
  .options-container {
    padding: 1rem;
  }
}
</style>

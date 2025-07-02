<template>
  <NLayout class="options-container">
    <!-- 提示信息 -->
    <NAlert v-if="alert.show" :title="alert.title" :type="alert.type" :closable="true" @close="alert.show = false"
      class="alert-message">
      {{ alert.message }}
    </NAlert>

    <NLayoutHeader class="header">
      <img src="/icon/active/128.png" class="logo" />
      <NH1>GitLab 代码审查助手</NH1>
    </NLayoutHeader>
    <NLayoutContent class="content">
      <NCard title="通用设置" class="settings-section">
        <NSpace vertical>
          <NFormItem label="启用代码审查">
            <NSwitch v-model:value="settings.detctor.isEnable" />
          </NFormItem>
        </NSpace>
      </NCard>

      <NCard title="AI 代理设置" class="settings-section">
        <NSpace vertical>
          <NFormItem label="AI 代理">
            <NSelect v-model:value="settings.aiAgent.current" :options="aiAgentOptions" style="width: 200px" />
          </NFormItem>

          <template v-if="settings.aiAgent.current === 'ollama'">
            <NFormItem label="Ollama 地址">
              <NInput v-model:value="settings.aiAgent.aiAgentConfig.ollama.endpoint"
                placeholder="http://localhost:11434" @update:value="ensureOllamaConfig" />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">Ollama 服务器地址</NText>
              </template>
            </NFormItem>

            <NFormItem label="模型名称">
              <NInput v-model:value="settings.aiAgent.aiAgentConfig.ollama.model" placeholder="llama3"
                @update:value="ensureOllamaConfig" />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">要使用的模型名称</NText>
              </template>
            </NFormItem>
          </template>
        </NSpace>
      </NCard>

      <NCard title="提示词设置" class="settings-section">
        <template #header-extra>
          <NSpace>
            <NButton @click="resetPrompt" size="small" type="default">恢复默认</NButton>
          </NSpace>
        </template>
        <NInput v-model:value="settings.prompt.template" type="textarea" placeholder="请输入提示词模板"
          :autosize="{ minRows: 10 }" />
      </NCard>

      <div class="actions">
        <NButton type="primary" @click="saveSettings" :loading="isSaving">
          保存设置
        </NButton>
        <NButton @click="resetSettings" :disabled="isSaving">
          恢复默认
        </NButton>
      </div>
    </NLayoutContent>
  </NLayout>
</template>

<script lang="ts" setup>
import browser from "webextension-polyfill";
import { ref, onMounted } from 'vue';
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
  NAlert
} from 'naive-ui';
import { DEFAUTL_PROMPT } from '../constants';
import type { Settings } from '../types';

// 提示信息状态
const alert = ref({
  show: false,
  title: '',
  message: '',
  type: 'info' as 'info' | 'success' | 'warning' | 'error'
});

// 显示提示信息
const showAlert = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title: string = '提示') => {
  alert.value = {
    show: true,
    title,
    message,
    type
  };
  // 3秒后自动隐藏
  if (type !== 'error') {
    setTimeout(() => {
      alert.value.show = false;
    }, 3000);
  }
};

// 设置数据
const settings = ref<Settings>({
  detctor: {
    isEnable: true,
  },
  aiAgent: {
    current: 'ollama',
    aiAgentConfig: {
      ollama: {
        endpoint: 'http://localhost:11434',
        model: 'llama3'
      }
    }
  },
  prompt: {
    template: DEFAUTL_PROMPT
  }
});

// AI 代理选项
const aiAgentOptions = [
  { label: 'Ollama', value: 'ollama' }
];

// 保存状态
const isSaving = ref(false);

// 确保 Ollama 配置存在
const ensureOllamaConfig = () => {
  if (!settings.value.aiAgent.aiAgentConfig.ollama) {
    settings.value.aiAgent.aiAgentConfig.ollama = {
      endpoint: 'http://localhost:11434',
      model: 'llama3'
    };
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    isSaving.value = true;
    await browser.storage.sync.set({ settings: settings.value });
    showAlert('设置已保存', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showAlert('保存失败，请重试', 'error');
  } finally {
    isSaving.value = false;
  }
};

// 重置提示词
const resetPrompt = () => {
  settings.value.prompt.template = DEFAUTL_PROMPT;
  showAlert('已恢复默认提示词', 'success');
};

// 重置所有设置
const resetSettings = async () => {
  try {
    isSaving.value = true;
    await browser.storage.sync.clear();
    settings.value = {
      ...settings.value,
      prompt: {
        template: DEFAUTL_PROMPT
      }
    };
    showAlert('已恢复默认设置', 'success');
  } catch (error) {
    console.error('重置设置失败:', error);
    showAlert('重置失败，请重试', 'error');
  } finally {
    isSaving.value = false;
  }
};

// 加载设置
const loadSettings = async () => {
  try {
    const data = await browser.storage.sync.get('settings');
    if (data.settings) {
      settings.value = {
        ...settings.value,
        ...data.settings,
        aiAgent: {
          ...settings.value.aiAgent,
          ...data.settings.aiAgent,
          aiAgentConfig: {
            ...settings.value.aiAgent.aiAgentConfig,
            ...(data.settings.aiAgent?.aiAgentConfig || {})
          }
        }
      };
      ensureOllamaConfig();
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    showAlert('加载设置失败', 'error');
  }
};

// 初始化
onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.options-container {
  min-height: 100vh;
  background-color: var(--n-color);
}

.alert-message {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 600px;
  z-index: 1000;
  box-shadow: 0 3px 6px -4px #0000001f, 0 6px 16px #00000014, 0 9px 28px 8px #0000000d;
}

.header {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--n-divider-color);
}

.logo {
  width: 24px;
  height: 24px;
}

.content {
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-section {
  margin-bottom: 16px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
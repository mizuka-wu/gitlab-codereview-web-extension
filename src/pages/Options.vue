<template>
  <NLayout class="options-container">
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
              <NInput v-model:value="ollamaEndpoint" placeholder="http://localhost:11434" />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">Ollama 服务器地址</NText>
              </template>
            </NFormItem>

            <NFormItem label="模型名称">
              <NInput v-model:value="ollamaModel" placeholder="llama3" />
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
import { ref, onMounted, computed } from 'vue';
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
  useMessage
} from 'naive-ui';
import { DEFAUTL_PROMPT } from '../constants';
import type { Settings } from '../types';

const message = useMessage();

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

// 通过 computed 代理避免模板中的可选链导致的类型报错
const ollamaEndpoint = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.ollama?.endpoint ?? 'http://localhost:11434',
  set: (v: string) => {
    ensureOllamaConfig();
    settings.value.aiAgent.aiAgentConfig.ollama!.endpoint = v;
  }
});

const ollamaModel = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.ollama?.model ?? 'llama3',
  set: (v: string) => {
    ensureOllamaConfig();
    settings.value.aiAgent.aiAgentConfig.ollama!.model = v;
  }
});

// 将任意 URL 转为权限匹配用的 origin/*
const toOriginPattern = (url: string): string => {
  try {
    const u = new URL((url || '').trim());
    return `${u.origin}/*`;
  } catch {
    return '';
  }
};

// 申请运行时主机权限（仅在支持的浏览器/上下文生效）
const ensureHostPermissionForEndpoint = async (endpoint: string) => {
  const origin = toOriginPattern(endpoint);
  if (!origin) throw new Error('Ollama 地址不合法');
  const permsApi: any = (browser as any).permissions;
  // 在不支持 permissions API 的环境下直接跳过
  if (!permsApi?.contains || !permsApi?.request) return;
  const has = await permsApi.contains({ origins: [origin] });
  console.log('权限结果', has)
  if (!has) {
    const granted = await permsApi.request({ origins: [origin] });
    if (!granted) throw new Error(`未授予访问权限：${origin}`);
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    isSaving.value = true;
    // 在保存前为自定义 Ollama 地址申请运行时主机权限
    await ensureHostPermissionForEndpoint(ollamaEndpoint.value);
    await browser.storage.sync.set({ settings: settings.value });
    // 广播设置更新，通知所有标签页与内容脚本
    try {
      await browser.runtime.sendMessage({
        action: 'settingsUpdated',
        settings: settings.value,
      });
    } catch (e) {
      console.warn('广播设置更新失败（可忽略）:', e);
    }
    message.success('设置已保存');
  } catch (error) {
    console.error('保存设置失败:', error);
    const msg = (error as Error)?.message || '保存失败，请重试';
    message.error(msg);
  } finally {
    isSaving.value = false;
  }
};

// 重置提示词
const resetPrompt = () => {
  settings.value.prompt.template = DEFAUTL_PROMPT;
  message.success('已恢复默认提示词');
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
    await browser.storage.sync.set({ settings: settings.value });
    // 广播设置更新
    try {
      await browser.runtime.sendMessage({
        action: 'settingsUpdated',
        settings: settings.value,
      });
    } catch (e) {
      console.warn('广播设置更新失败（可忽略）:', e);
    }
    message.success('已恢复默认设置');
  } catch (error) {
    console.error('重置设置失败:', error);
    message.error('重置失败，请重试');
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
    message.error('加载设置失败');
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

.header {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--n-divider-color);
  justify-content: center;
  flex-direction: column;
}

.logo {
  width: 128px;
  height: 128px;
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
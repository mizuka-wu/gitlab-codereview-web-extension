<template>
  <NLayout class="options-container">
    <NLayoutHeader class="header">
      <img src="/icon/active/128.png" class="logo" />
      <NH1>{{ $t('common.appTitle') }}</NH1>
    </NLayoutHeader>
    <NLayoutContent class="content">
      <NCard :title="$t('options.languageSettings')" class="settings-section">
        <NSpace vertical>
          <NFormItem :label="$t('options.uiLanguage')">
            <NSelect
              v-model:value="locale"
              :options="localeOptions"
              style="width: 200px"
              @update:value="onLocaleChange"
            />
          </NFormItem>
        </NSpace>
      </NCard>

      <NCard :title="$t('options.generalSettings')" class="settings-section">
        <NSpace vertical>
          <NFormItem :label="$t('options.enableCodeReview')">
            <NSwitch v-model:value="settings.detctor.isEnable" />
          </NFormItem>
        </NSpace>
      </NCard>

      <NCard :title="$t('options.aiAgentSettings')" class="settings-section">
        <NSpace vertical>
          <NFormItem :label="$t('options.aiAgent')">
            <NSelect v-model:value="settings.aiAgent.current" :options="aiAgentOptions" style="width: 200px" />
          </NFormItem>

          <template v-if="settings.aiAgent.current === 'ollama'">
            <NFormItem :label="$t('options.ollamaAddress')">
              <NInput v-model:value="ollamaEndpoint" placeholder="http://localhost:11434" />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">{{ $t('options.ollamaServerAddress') }}</NText>
              </template>
            </NFormItem>

            <NFormItem :label="$t('options.modelName')">
              <NSpace align="center">
                <NSelect
                  v-model:value="ollamaModel"
                  :options="ollamaModelOptions"
                  filterable
                  clearable
                  :placeholder="$t('options.selectOrRefreshModel')"
                  style="width: 240px"
                />
                <NButton @click="refreshModels" size="small" :loading="isLoadingModels">{{ $t('common.refresh') }}</NButton>
                <NButton @click="testOllama" size="small" tertiary>{{ $t('common.testConnection') }}</NButton>
              </NSpace>
            </NFormItem>
          </template>
        </NSpace>
      </NCard>

      <NCard :title="$t('options.promptSettings')" class="settings-section">
        <template #header-extra>
          <NSpace>
            <NButton @click="resetPrompt" size="small" type="default">{{ $t('common.reset') }}</NButton>
          </NSpace>
        </template>
        <NInput v-model:value="settings.prompt.template" type="textarea" :placeholder="$t('options.placeholderPrompt')"
          :autosize="{ minRows: 10 }" />
      </NCard>

      <div class="actions">
        <NButton type="primary" @click="saveSettings" :loading="isSaving">
          {{ $t('common.saveSettings') }}
        </NButton>
        <NButton @click="resetSettings" :disabled="isSaving">
          {{ $t('common.reset') }}
        </NButton>
      </div>
    </NLayoutContent>
  </NLayout>
</template>

<script lang="ts" setup>
import browser from "webextension-polyfill";
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
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
import type { Settings, Locale } from '../types';
import { listOllamaModels, isOllamaModelAvailable } from '../task/agent/ollama';
import { supportedLocales } from '../i18n';

const message = useMessage();
const { t, locale: i18nLocale } = useI18n();

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
        model: ''
      }
    }
  },
  prompt: {
    template: DEFAUTL_PROMPT
  },
  locale: 'zh-CN'
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
      model: ''
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
  get: () => settings.value.aiAgent.aiAgentConfig.ollama?.model ?? '',
  set: (v: string) => {
    ensureOllamaConfig();
    settings.value.aiAgent.aiAgentConfig.ollama!.model = v;
  }
});

// 语言选项与绑定
const locale = computed<Locale>({
  get: () => (settings.value.locale ?? 'zh-CN') as Locale,
  set: (v: Locale) => {
    settings.value.locale = v;
  }
});
const localeOptions = supportedLocales;
const onLocaleChange = async (v: Locale) => {
  i18nLocale.value = v;
  settings.value.locale = v;
  try {
    await browser.storage.sync.set({ settings: settings.value });
    try {
      await browser.runtime.sendMessage({
        action: 'settingsUpdated',
        settings: settings.value,
      });
    } catch (e) {
      console.warn(t('options.broadcastFailed') + ':', e);
    }
  } catch (e) {
    console.error('保存语言失败:', e);
  }
};

// 模型列表与操作
const isLoadingModels = ref(false);
const models = ref<string[]>([]);
const ollamaModelOptions = computed(() =>
  Array.from(new Set([...(models.value || []), ...(ollamaModel.value ? [ollamaModel.value] : [])]))
    .filter(Boolean)
    .map((n) => ({ label: n as string, value: n as string }))
);

const refreshModels = async () => {
  try {
    isLoadingModels.value = true;
    await ensureHostPermissionForEndpoint(ollamaEndpoint.value);
    const list = await listOllamaModels(ollamaEndpoint.value);
    models.value = list;
    message.success(t('model.fetched', { count: list.length }));
  } catch (e) {
    console.error('获取模型失败:', e);
    const msg = (e as Error)?.message || t('model.fetchFailed');
    message.error(String(msg));
  } finally {
    isLoadingModels.value = false;
  }
};

const testOllama = async () => {
  try {
    await ensureHostPermissionForEndpoint(ollamaEndpoint.value);
    if (ollamaModel.value) {
      const ok = await isOllamaModelAvailable(ollamaEndpoint.value, ollamaModel.value);
      if (ok) {
        message.success(t('model.testOkModelOk'));
      } else {
        message.warning(t('model.testOkModelMissing'));
      }
    } else {
      const list = await listOllamaModels(ollamaEndpoint.value);
      message.success(t('model.testOkCount', { count: list.length }));
    }
  } catch (e) {
    console.error('测试连接失败:', e);
    const msg = (e as Error)?.message || t('model.testFailed');
    message.error(String(msg));
  }
};

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
  if (!origin) throw new Error(t('permission.invalidEndpoint'));
  const permsApi: any = (browser as any).permissions;
  // 在不支持 permissions API 的环境下直接跳过
  if (!permsApi?.contains || !permsApi?.request) return;
  const has = await permsApi.contains({ origins: [origin] });
  console.log('权限结果', has)
  if (!has) {
    const granted = await permsApi.request({ origins: [origin] });
    if (!granted) throw new Error(t('permission.notGranted', { origin }));
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
      console.warn(t('options.broadcastFailed') + ':', e);
    }
    message.success(t('common.saved'));
  } catch (error) {
    console.error('保存设置失败:', error);
    const msg = (error as Error)?.message || t('common.saveFailed');
    message.error(String(msg));
  } finally {
    isSaving.value = false;
  }
};

// 重置提示词
const resetPrompt = () => {
  settings.value.prompt.template = DEFAUTL_PROMPT;
  message.success(t('common.resetPromptDone'));
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
      console.warn(t('options.broadcastFailed') + ':', e);
    }
    message.success(t('common.resetDone'));
  } catch (error) {
    console.error('重置设置失败:', error);
    message.error(t('common.resetFailed'));
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
      // 同步 i18n 语言
      if (settings.value.locale) {
        i18nLocale.value = settings.value.locale as Locale;
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    message.error(t('common.loadFailed'));
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
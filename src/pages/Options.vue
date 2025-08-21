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

          <template v-if="settings.aiAgent.current === 'openai'">
            <NFormItem :label="$t('options.apiKey')">
              <NInput 
                v-model:value="openaiApiKey" 
                type="password" 
                :placeholder="$t('options.enterOpenAIKey')"
                style="width: 400px"
              />
            </NFormItem>
            
            <NFormItem :label="$t('options.baseUrl')">
              <NInput 
                v-model:value="openaiBaseUrl" 
                :placeholder="'https://api.openai.com'"
                style="width: 400px"
              />
            </NFormItem>
            
            <NFormItem :label="$t('options.modelName')">
              <NSelect
                v-model:value="openaiModel"
                :options="openaiModelOptions"
                filterable
                clearable
                :placeholder="$t('options.selectModel')"
                style="width: 240px"
              />
            </NFormItem>
            
            <NFormItem :label="$t('options.timeout')">
              <NInput 
                v-model:value="openaiTimeout" 
                type="number" 
                :placeholder="'60000'"
                style="width: 200px"
              />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">ms</NText>
              </template>
            </NFormItem>
          </template>

          <template v-if="settings.aiAgent.current === 'claude'">
            <NFormItem :label="$t('options.apiKey')">
              <NInput 
                v-model:value="claudeApiKey" 
                type="password" 
                :placeholder="$t('options.enterClaudeKey')"
                style="width: 400px"
              />
            </NFormItem>
            
            <NFormItem :label="$t('options.baseUrl')">
              <NInput 
                v-model:value="claudeBaseUrl" 
                :placeholder="'https://api.anthropic.com'"
                style="width: 400px"
              />
            </NFormItem>
            
            <NFormItem :label="$t('options.modelName')">
              <NSelect
                v-model:value="claudeModel"
                :options="claudeModelOptions"
                filterable
                clearable
                :placeholder="$t('options.selectModel')"
                style="width: 240px"
              />
            </NFormItem>
            
            <NFormItem :label="$t('options.timeout')">
              <NInput 
                v-model:value="claudeTimeout" 
                type="number" 
                :placeholder="'60000'"
                style="width: 200px"
              />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">ms</NText>
              </template>
            </NFormItem>
          </template>

          <template v-if="settings.aiAgent.current === 'openapi'">
            <NFormItem :label="$t('options.apiKey')">
              <NInput 
                v-model:value="openapiApiKey" 
                type="password" 
                :placeholder="$t('options.enterOpenAPIKey')"
                style="width: 400px"
              />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">{{ $t('options.optional') }}</NText>
              </template>
            </NFormItem>
            
            <NFormItem :label="$t('options.baseUrl')">
              <NInput 
                v-model:value="openapiBaseUrl" 
                :placeholder="'http://localhost:8000'"
                style="width: 400px"
              />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">{{ $t('options.required') }}</NText>
              </template>
            </NFormItem>
            
            <NFormItem :label="$t('options.modelName')">
              <NInput 
                v-model:value="openapiModel" 
                :placeholder="'default'"
                style="width: 240px"
              />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">{{ $t('options.modelNameHint') }}</NText>
              </template>
            </NFormItem>
            
            <NFormItem :label="$t('options.timeout')">
              <NInput 
                v-model:value="openapiTimeout" 
                type="number" 
                :placeholder="'60000'"
                style="width: 200px"
              />
              <template #suffix>
                <NText depth="3" style="font-size: 12px">ms</NText>
              </template>
            </NFormItem>

            <!-- 高级配置折叠面板 -->
            <NCollapse>
              <NCollapseItem :title="$t('options.advancedSettings')" name="advanced">
                <NSpace vertical>
                  <!-- 认证类型 -->
                  <NFormItem :label="$t('options.authType')">
                    <NSelect
                      v-model:value="openapiAuthType"
                      :options="authTypeOptions"
                      style="width: 200px"
                    />
                  </NFormItem>

                  <!-- 认证Header名称 -->
                  <NFormItem v-if="openapiAuthType !== 'none'" :label="$t('options.authHeaderName')">
                    <NInput 
                      v-model:value="openapiAuthHeaderName" 
                      :placeholder="'Authorization'"
                      style="width: 200px"
                    />
                  </NFormItem>

                  <!-- 请求方法 -->
                  <NFormItem :label="$t('options.requestMethod')">
                    <NSelect
                      v-model:value="openapiRequestMethod"
                      :options="requestMethodOptions"
                      style="width: 200px"
                    />
                  </NFormItem>

                  <!-- 内容类型 -->
                  <NFormItem :label="$t('options.contentType')">
                    <NInput 
                      v-model:value="openapiContentType" 
                      :placeholder="'application/json'"
                      style="width: 200px"
                    />
                  </NFormItem>

                  <!-- 自定义Headers -->
                  <NFormItem :label="$t('options.customHeaders')">
                    <NInput 
                      v-model:value="openapiCustomHeadersText" 
                      type="textarea" 
                      :placeholder="$t('options.customHeadersPlaceholder')"
                      :autosize="{ minRows: 3, maxRows: 6 }"
                      style="width: 400px"
                    />
                    <template #suffix>
                      <NText depth="3" style="font-size: 12px">{{ $t('options.jsonFormat') }}</NText>
                    </template>
                  </NFormItem>

                  <!-- 自定义请求参数 -->
                  <NFormItem :label="$t('options.customParams')">
                    <NInput 
                      v-model:value="openapiCustomParamsText" 
                      type="textarea" 
                      :placeholder="$t('options.customParamsPlaceholder')"
                      :autosize="{ minRows: 3, maxRows: 6 }"
                      style="width: 400px"
                    />
                    <template #suffix>
                      <NText depth="3" style="font-size: 12px">{{ $t('options.jsonFormat') }}</NText>
                    </template>
                  </NFormItem>

                  <!-- 测试连接按钮 -->
                  <NFormItem>
                    <NButton @click="testOpenAPI" size="small" tertiary>{{ $t('common.testConnection') }}</NButton>
                  </NFormItem>
                </NSpace>
              </NCollapseItem>
            </NCollapse>
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
  useMessage,
  NCollapse,
  NCollapseItem
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
  { label: 'Ollama', value: 'ollama' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Claude', value: 'claude' },
  { label: 'OpenAPI 兼容服务', value: 'openapi' }
];

// OpenAI 模型选项
const openaiModelOptions = [
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { label: 'GPT-3.5 Turbo 16K', value: 'gpt-3.5-turbo-16k' },
  { label: 'GPT-4', value: 'gpt-4' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' }
];

// Claude 模型选项
const claudeModelOptions = [
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' }
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

// 确保 OpenAI 配置存在
const ensureOpenAIConfig = () => {
  if (!settings.value.aiAgent.aiAgentConfig.openai) {
    settings.value.aiAgent.aiAgentConfig.openai = {
      apiKey: '',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-3.5-turbo',
      timeoutMs: 60000
    };
  }
};

// 确保 Claude 配置存在
const ensureClaudeConfig = () => {
  if (!settings.value.aiAgent.aiAgentConfig.claude) {
    settings.value.aiAgent.aiAgentConfig.claude = {
      apiKey: '',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-3-haiku-20240307',
      timeoutMs: 60000
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

// OpenAI 配置计算属性
const openaiApiKey = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openai?.apiKey ?? '',
  set: (v: string) => {
    ensureOpenAIConfig();
    settings.value.aiAgent.aiAgentConfig.openai!.apiKey = v;
  }
});

const openaiBaseUrl = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openai?.baseUrl ?? 'https://api.openai.com',
  set: (v: string) => {
    ensureOpenAIConfig();
    settings.value.aiAgent.aiAgentConfig.openai!.baseUrl = v;
  }
});

const openaiModel = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openai?.model ?? 'gpt-3.5-turbo',
  set: (v: string) => {
    ensureOpenAIConfig();
    settings.value.aiAgent.aiAgentConfig.openai!.model = v;
  }
});

const openaiTimeout = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openai?.timeoutMs ?? 60000,
  set: (v: number) => {
    ensureOpenAIConfig();
    settings.value.aiAgent.aiAgentConfig.openai!.timeoutMs = v;
  }
});

// Claude 配置计算属性
const claudeApiKey = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.claude?.apiKey ?? '',
  set: (v: string) => {
    ensureClaudeConfig();
    settings.value.aiAgent.aiAgentConfig.claude!.apiKey = v;
  }
});

const claudeBaseUrl = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.claude?.baseUrl ?? 'https://api.anthropic.com',
  set: (v: string) => {
    ensureClaudeConfig();
    settings.value.aiAgent.aiAgentConfig.claude!.baseUrl = v;
  }
});

const claudeModel = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.claude?.model ?? 'claude-3-haiku-20240307',
  set: (v: string) => {
    ensureClaudeConfig();
    settings.value.aiAgent.aiAgentConfig.claude!.model = v;
  }
});

const claudeTimeout = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.claude?.timeoutMs ?? 60000,
  set: (v: number) => {
    ensureClaudeConfig();
    settings.value.aiAgent.aiAgentConfig.claude!.timeoutMs = v;
  }
});

// OpenAPI 兼容服务配置计算属性
const openapiApiKey = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.apiKey ?? '',
  set: (v: string) => {
    // 确保配置存在，如果不存在则初始化
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.apiKey = v;
  }
});

const openapiBaseUrl = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.baseUrl ?? 'http://localhost:8000',
  set: (v: string) => {
    // 确保配置存在，如果不存在则初始化
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.baseUrl = v;
  }
});

const openapiModel = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.model ?? 'default',
  set: (v: string) => {
    // 确保配置存在，如果不存在则初始化
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.model = v;
  }
});

const openapiTimeout = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.timeoutMs ?? 60000,
  set: (v: number) => {
    // 确保配置存在，如果不存在则初始化
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.timeoutMs = v;
  }
});

// 高级配置选项
const authTypeOptions = [
  { label: 'None', value: 'none' },
  { label: 'Bearer Token', value: 'bearer' },
  { label: 'API Key', value: 'apiKey' }
];

const openapiAuthType = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.authType ?? 'none',
  set: (v: string) => {
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.authType = v;
  }
});

const openapiAuthHeaderName = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.authHeaderName ?? 'Authorization',
  set: (v: string) => {
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.authHeaderName = v;
  }
});

const requestMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'OPTIONS', value: 'OPTIONS' },
  { label: 'HEAD', value: 'HEAD' },
  { label: 'CONNECT', value: 'CONNECT' },
  { label: 'TRACE', value: 'TRACE' }
];

const openapiRequestMethod = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.requestMethod ?? 'GET',
  set: (v: string) => {
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.requestMethod = v;
  }
});

const contentTypeOptions = [
  { label: 'application/json', value: 'application/json' },
  { label: 'application/x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
  { label: 'multipart/form-data', value: 'multipart/form-data' },
  { label: 'text/plain', value: 'text/plain' }
];

const openapiContentType = computed({
  get: () => settings.value.aiAgent.aiAgentConfig.openapi?.contentType ?? 'application/json',
  set: (v: string) => {
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    settings.value.aiAgent.aiAgentConfig.openapi!.contentType = v;
  }
});

const openapiCustomHeadersText = computed({
  get: () => JSON.stringify(settings.value.aiAgent.aiAgentConfig.openapi?.customHeaders ?? {}, null, 2),
  set: (v: string) => {
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    try {
      settings.value.aiAgent.aiAgentConfig.openapi!.customHeaders = JSON.parse(v);
    } catch (e) {
      console.error('解析自定义Headers失败:', e);
      message.error(t('options.invalidJson'));
    }
  }
});

const openapiCustomParamsText = computed({
  get: () => JSON.stringify(settings.value.aiAgent.aiAgentConfig.openapi?.customParams ?? {}, null, 2),
  set: (v: string) => {
    if (!settings.value.aiAgent.aiAgentConfig.openapi) {
      settings.value.aiAgent.aiAgentConfig.openapi = {
        apiKey: '',
        baseUrl: 'http://localhost:8000',
        model: 'default',
        timeoutMs: 60000
      };
    }
    try {
      settings.value.aiAgent.aiAgentConfig.openapi!.customParams = JSON.parse(v);
    } catch (e) {
      console.error('解析自定义Params失败:', e);
      message.error(t('options.invalidJson'));
    }
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
    await browser.storage.local.set({ settings: settings.value });
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
    const available = await isOllamaModelAvailable(ollamaEndpoint.value, ollamaModel.value);
    if (available) {
      message.success(t('model.testOkModelOk'));
    } else {
      message.warning(t('model.testOkModelMissing'));
    }
  } catch (e) {
    console.error('测试 Ollama 失败:', e);
    const msg = (e as Error)?.message || t('model.testFailed');
    message.error(String(msg));
  }
};

const testOpenAPI = async () => {
  try {
    const config = settings.value.aiAgent.aiAgentConfig.openapi;
    if (!config?.baseUrl) {
      message.error('请先配置服务地址');
      return;
    }

    // 构建测试请求
    const testConfig = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl,
      model: config.model || 'default',
      timeoutMs: config.timeoutMs || 60000,
      customHeaders: config.customHeaders || {},
      customParams: config.customParams || {},
      requestMethod: config.requestMethod || 'POST',
      contentType: config.contentType || 'application/json',
      authType: config.authType || 'bearer',
      authHeaderName: config.authHeaderName || 'Authorization',
      authQueryName: config.authQueryName || 'token'
    };

    // 创建测试客户端
    const { createApiClient } = await import('../task/agent/api-client');
    const client = createApiClient('openapi', testConfig);

    // 发送测试请求
    const response = await client.generate({
      prompt: 'Hello, this is a test message.',
      config: testConfig,
      stream: false,
      options: {}
    });

    if (response.content) {
      message.success('连接测试成功！服务响应正常。');
    } else {
      message.warning('连接成功，但响应内容为空。');
    }
  } catch (e) {
    console.error('测试 OpenAPI 服务失败:', e);
    const msg = (e as Error)?.message || '测试失败';
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
    await browser.storage.local.set({ settings: settings.value });
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
    await browser.storage.local.clear();
    settings.value = {
      ...settings.value,
      prompt: {
        template: DEFAUTL_PROMPT
      }
    };
    await browser.storage.local.set({ settings: settings.value });
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
    const data = await browser.storage.local.get('settings');
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
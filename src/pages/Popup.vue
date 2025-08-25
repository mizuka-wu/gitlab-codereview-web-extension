<template>
  <div class="popup-container">
    <div class="app-header">
      <h1 class="app-title">{{ $t('common.appTitle') }}</h1>
      <p class="app-subtitle">{{ $t('popup.subtitle') }}</p>
    </div>
    <NCard size="small" class="status-card" :bordered="false" v-if="!isSupportAnalysis">
      <template #header>
        <div class="status-header">
          <h3 class="status-title">{{ $t('popup.pageStatus') }}</h3>
        </div>
      </template>

      <div class="status-list">
        <div v-for="(status, index) in statusList" :key="index" class="status-item">
          <div class="status-icon" :class="{ 'status-success': status.value, 'status-error': !status.value }">
            <NIcon v-if="status.value" :component="CheckmarkCircle" size="18" />
            <NIcon v-else :component="Square" size="18" />
          </div>
          <span class="status-label">{{ status.label }}</span>
          <NTag :type="status.value ? 'success' : 'default'" size="small" round class="status-tag">
            {{ status.value ? $t('popup.satisfied') : $t('popup.unsatisfied') }}
          </NTag>
        </div>
      </div>

      <template #footer>
        <div v-if="!isSupportAnalysis" class="status-message">
          <NIcon :component="InfoCircle" size="16" class="info-icon" />
          <span>{{ $t('popup.useInMrPage') }}</span>
        </div>
      </template>
    </NCard>

    <Task v-model="task" v-if="task" :key="task.uuid" />
    <div class="actions" v-else>
      <NButton @click="analysis" type="primary" :disabled="!isSupportAnalysis" class="action-button"
        :class="{ 'is-active': isSupportAnalysis }">
        {{ $t('popup.startAnalysis') }}
      </NButton>
      <NButton ghost @click="browser.runtime.openOptionsPage()" class="action-button">
        {{ $t('popup.settings') }}
      </NButton>
    </div>

    <footer class="footer">
      <div class="version">{{ $t('popup.version', { version }) }}</div>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { v4 as uuid } from 'uuid';
import browser from "webextension-polyfill";
import { ref, computed, onMounted, onBeforeMount, onBeforeUnmount, onBeforeUpdate } from 'vue'
import { useI18n } from 'vue-i18n';
import { NResult, NButton, NTag, NIcon, NSwitch, NCard, NDescriptions, NDescriptionsItem } from 'naive-ui';
import { CheckmarkCircle, Square, InformationCircle as InfoCircle } from '@vicons/ionicons5';
import Task from './popup/Task.vue';
import { type GitLabDetection, type AnalysisTask } from "../types";

const { t, locale: i18nLocale } = useI18n();

// detection检测部分
const isGitLabRef = ref<boolean>(false);
const isReviewPageRef = ref<boolean>(false);
const isLoading = ref<boolean>(true);

const statusList = computed(() => [
  {
    label: t('popup.isGitLabPage'),
    value: isGitLabRef.value,
  },
  {
    label: t('popup.isMrPage'),
    value: isReviewPageRef.value,
  }
]);

const isSupportAnalysis = computed(() => {
  return isGitLabRef.value && isReviewPageRef.value;
});
function updateStatus(detectionState: GitLabDetection) {
  const { isGitLab, isReviewPage } = detectionState;
  isGitLabRef.value = isGitLab;
  isReviewPageRef.value = isReviewPage;
  isLoading.value = false;
}

// task
const task = ref<AnalysisTask | null>(null);
async function analysis() {
  if (task.value) return;

  // 获取当前活动标签页的URL
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const currentTab = tabs[0];
  const mergeRequestUrl = currentTab?.url || "";

  task.value = {
    mergeRequestUrl,
    uuid: uuid(),
    status: "pending",
  }
}


// 初始化
async function initPopup() {
  // 重置状态，确保每次都是重新检测
  isLoading.value = true;
  isGitLabRef.value = false;
  isReviewPageRef.value = false;
  
  // 获取当前活动标签页
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const currentTab = tabs[0];

  // 获取GitLab检测状态
  if (currentTab && currentTab.id) {
    try {
      const response = await browser.tabs.sendMessage(currentTab.id, {
        action: "getGitLabStatus",
      });
      if (response && response.isGitLab !== undefined) {
        updateStatus(response);
      } else {
        // 如果没有响应，设置为未满足状态
        updateStatus({
          isGitLab: false, isReviewPage: false, url: currentTab.url||'', title: currentTab.title||'',
          timestamp: 0
        });
      }
    } catch (error) {
      console.error("获取GitLab状态失败:", error);
      // 从本地存储获取最后的检测状态，但优先使用当前页面信息
      const result = await browser.storage.local.get("gitlabDetection");
      if (result.gitlabDetection) {
        // 检查存储的检测状态是否与当前页面匹配
        if (result.gitlabDetection.url === currentTab.url) {
          updateStatus(result.gitlabDetection);
        } else {
          // 如果URL不匹配，重新设置为未满足状态
          updateStatus({
            isGitLab: false, isReviewPage: false, url: currentTab.url||'', title: currentTab.title||'',
            timestamp: 0
          });
        }
      } else {
        // 如果没有存储的状态，设置为未满足状态
        updateStatus({
          isGitLab: false, isReviewPage: false, url: currentTab.url||'', title: currentTab.title||'',
          timestamp: 0
        });
      }
    }
  }
}

// i18n：从存储同步语言，并监听设置更新
const version = ref('');
async function syncLocaleFromSettings() {
  try {
    const data = await browser.storage.local.get('settings');
    const locale = data?.settings?.locale;
    if (locale) i18nLocale.value = locale as any;
  } catch {}
}
const handleRuntimeMessage = (message: any) => {
  if (message?.action === 'settingsUpdated' && message.settings?.locale) {
    i18nLocale.value = message.settings.locale as any;
  }
};

// 每次弹窗显示时都重新检测
onMounted(() => {
  initPopup();
  syncLocaleFromSettings();
  version.value = (browser.runtime.getManifest?.() as any)?.version || '';
  try { browser.runtime.onMessage.addListener(handleRuntimeMessage); } catch {}
});

// 移除不必要的事件监听器
onBeforeUnmount(() => {
  try { browser.runtime.onMessage.removeListener(handleRuntimeMessage); } catch {}
});

</script>

<style scoped>
.popup-container {
  width: 300px;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-header {
  text-align: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.app-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color);
  line-height: 1.4;
}

.app-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--n-text-color-3);
  font-weight: 400;
  line-height: 1.5;
}

.status-card {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--n-color-embedded);
}

.status-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.status-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color);
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
}

.status-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.status-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: scale(1);
}

.status-icon.status-success {
  background-color: rgba(18, 184, 134, 0.1);
  color: #12b886;
  animation: pulseSuccess 1.2s infinite;
}

.status-icon.status-error {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  animation: pulseError 1.2s infinite;
}

@keyframes pulseSuccess {
  0% {
    box-shadow: 0 0 0 0 rgba(18, 184, 134, 0.4);
  }

  70% {
    box-shadow: 0 0 0 8px rgba(18, 184, 134, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(18, 184, 134, 0);
  }
}

@keyframes pulseError {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }

  70% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.status-label {
  flex: 1;
  font-size: 14px;
  color: var(--n-text-color-2);
}

.status-tag {
  margin-left: 8px;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.status-message {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--n-color-embedded);
  border-radius: 6px;
  font-size: 13px;
  color: var(--n-text-color-3);
  margin-top: 12px;
}

.status-message .info-icon {
  margin-right: 8px;
  color: var(--n-text-color-2);
}



.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--n-divider-color);
  width: 100%;
}

.actions .n-button {
  min-width: 100px;
  flex: 1;

  &:nth-child(1) {
    flex: 2;
  }
}

.footer {
  margin-top: 16px;
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid var(--n-divider-color);
}

.version {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 8px;
}
</style>
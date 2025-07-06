<template>
  <div class="popup-container">
    <div class="app-header">
      <h1 class="app-title">GitLab 代码审查助手</h1>
      <p class="app-subtitle">高效代码审查，提升开发效率</p>
    </div>
    <NCard size="small" class="status-card" :bordered="false" v-if="!isSupportAnalysis">
      <template #header>
        <div class="status-header">
          <h3 class="status-title">页面状态检测</h3>
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
            {{ status.value ? '已满足' : '未满足' }}
          </NTag>
        </div>
      </div>

      <template #footer>
        <div v-if="!isSupportAnalysis" class="status-message">
          <NIcon :component="InfoCircle" size="16" class="info-icon" />
          <span>请在GitLab的Merge Request页面使用此功能</span>
        </div>
      </template>
    </NCard>

    <Task v-model="task" v-if="task" :key="task.uuid" />
    <div class="actions" v-else>
      <NButton @click="analysis" type="primary" :disabled="!isSupportAnalysis" class="action-button"
        :class="{ 'is-active': isSupportAnalysis }">
        开始分析
      </NButton>
      <NButton ghost @click="browser.runtime.openOptionsPage()" class="action-button">
        设置
      </NButton>
    </div>

    <footer class="footer">
      <div class="version">版本 1.0.0</div>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { v4 as uuid } from 'uuid';
import browser from "webextension-polyfill";
import { ref, computed, onMounted, onBeforeMount, onBeforeUnmount, onBeforeUpdate } from 'vue'
import { NResult, NButton, NTag, NIcon, NSwitch, NCard, NDescriptions, NDescriptionsItem } from 'naive-ui';
import { CheckmarkCircle, Square, InformationCircle as InfoCircle } from '@vicons/ionicons5';
import Task from './popup/Task.vue';
import { type GitLabDetection, type AnalysisTask } from "../types";

// detection检测部分
const isGitLabRef = ref<boolean>(false);
const isReviewPageRef = ref<boolean>(false);
const isLoading = ref<boolean>(true);

const statusList = computed(() => [
  {
    label: '当前为GitLab页面',
    value: isGitLabRef.value,
  },
  {
    label: '当前为MR页面',
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
function analysis() {
  if (task.value) return;
  task.value = {
    mergeRequestUrl: "",
    uuid: uuid(),
    status: "pending",
  }
}


// 初始化
async function initPopup() {
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
      }
    } catch (error) {
      console.error("获取GitLab状态失败:", error);
      // 从本地存储获取最后的检测状态
      const result = await browser.storage.local.get("gitlabDetection");
      if (result.gitlabDetection) {
        updateStatus(result.gitlabDetection);
      }
    }
  }
}
onBeforeMount(() => {
  document.addEventListener("DOMContentLoaded", initPopup);
})
onBeforeUpdate(() => {
  document.removeEventListener("DOMContentLoaded", initPopup);
  document.addEventListener("DOMContentLoaded", initPopup);
})
onBeforeUnmount(() => {
  document.removeEventListener("DOMContentLoaded", initPopup);
})


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
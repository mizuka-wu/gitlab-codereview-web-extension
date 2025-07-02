<template>
  <div class="popup-container">
    <div class="app-header">
      <h1 class="app-title">GitLab 代码审查助手</h1>
      <p class="app-subtitle">高效代码审查，提升开发效率</p>
    </div>
    <NCard size="small" class="status-card" :bordered="false">
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

    <div class="actions">
      <NButton type="primary" :disabled="!isSupportAnalysis" class="action-button"
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
import browser from "webextension-polyfill";
import { ref, computed, onMounted, onBeforeMount, onBeforeUnmount, onBeforeUpdate } from 'vue'
import { type GitLabDetection } from "../types";
import { NResult, NButton, NTag, NIcon, NSwitch, NCard, NDescriptions, NDescriptionsItem } from 'naive-ui';
import { CheckmarkCircle, Square, InformationCircle as InfoCircle } from '@vicons/ionicons5';

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

<style lang="scss">
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

html,
body {
  width: 320px;
  min-height: 200px;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f8f9fa;
}

.popup-container {
  padding: 20px 16px 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.app-header {
  text-align: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.app-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.4;
}

.app-subtitle {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  font-weight: 400;
  line-height: 1.5;
}

.status-card {
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
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
  color: #1f2937;
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
  padding: 8px 0;
  animation: fadeIn 0.3s ease-out;
  transition: all 0.3s ease;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 12px;
  border-radius: 50%;

  &.status-success {
    color: #10b981;
    background-color: #d1fae5;
  }

  &.status-error {
    color: #ef4444;
    background-color: #fee2e2;
  }
}

.status-label {
  flex: 1;
  font-size: 14px;
  color: #4b5563;
}

.status-tag {
  margin-left: 8px;
  font-size: 12px;
  transition: all 0.3s ease;
}

.status-message {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f3f4f6;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  margin-top: 12px;

  .info-icon {
    margin-right: 8px;
    color: #4b5563;
  }
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.action-button {
  flex: 1;
  transition: all 0.2s ease;

  &.is-active {
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.footer {
  margin-top: 16px;
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.version {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;
}
</style>
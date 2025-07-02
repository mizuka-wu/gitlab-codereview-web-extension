<template>
  <NResult size="small" v-if="!isSupportAnalysis" class="detection__container" status="404" title="不支持的页面">
    <template #icon>
      <div style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
        <NTag style="margin: 4px" round :bordered="false" :type="status.value ? 'success' : ''" v-for="status of [
          {
            label: 'Gitlab页面', value: isGitLabRef,
          },
          {
            label: 'Merge Request页面', value: isReviewPageRef,
          }
        ]" :key="status.label">
          {{ status.label }}
          <template #icon>
            <NIcon v-if="status.value" :component="CheckmarkCircle" />
          </template>
        </NTag>
      </div>
    </template>
  </NResult>
  <div v-else>11</div>
  <section class="actions">
    <div class="actions__analysis" v-if="isSupportAnalysis">
      <NButton type="primary">
        开始分析
      </NButton>
    </div>
    <div>
      <NButton @click="browser.runtime.openOptionsPage()">
        设置
      </NButton>
    </div>
  </section>
  <footer>
    <div class="version">版本 1.0.0</div>
  </footer>
</template>

<script lang="ts" setup>
import browser from "webextension-polyfill";
import { ref, computed, onMounted, onBeforeMount, onBeforeUnmount, onBeforeUpdate } from 'vue'
import { type GitLabDetection } from "../types";
import { NResult, NButton, NTag, NIcon, NSwitch, NCard, NDescriptions, NDescriptionsItem } from 'naive-ui';
import { CheckmarkCircle, Square } from '@vicons/ionicons5';

// detection检测部分
const isGitLabRef = ref<boolean>(false);
const isReviewPageRef = ref<boolean>(false);
const isSupportAnalysis = computed(() => {
  return isGitLabRef.value && isReviewPageRef.value
})
function updateStatus(detectionState: GitLabDetection) {
  const { isGitLab, isReviewPage } = detectionState;
  isGitLabRef.value = isGitLab;
  isReviewPageRef.value = isReviewPage;
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
html,
body {
  width: 300px;
  max-height: 400px;
  padding: 8px;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.detection__container {
  margin-bottom: 32px;
}

.actions {
  display: flex;
  flex-direction: row;
  margin-top: 8px;
  width: 100%;
  justify-content: center;
  align-items: center;
  max-width: 180px;

  &__analysis {
    flex: 1;
    margin-right: 8px;

    &>button {
      width: 100%;
    }
  }
}
</style>
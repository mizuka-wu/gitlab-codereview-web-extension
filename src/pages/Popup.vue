<template>
  <section class="detection-status" v-if="!isSupportAnalysis">
    <div class="status-item">
      <span class="label">GitLab页面:</span>
      <span class="status">{{ isGitLabRef ? '已检测到' : '检测中' }}</span>
    </div>
    <div class="status-item">
      <span class="label">代码审查页面:</span>
      <span class="status">{{ isReviewPageRef ? '已检测到' : '检测中' }}</span>
    </div>
  </section>
  <section v-else>
    111
  </section>
</template>

<script lang="ts" setup>
import browser from "webextension-polyfill";
import { ref, computed, onMounted, onBeforeMount, onBeforeUnmount } from 'vue'
import { type GitLabDetection } from "../types";

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
onBeforeUnmount(() => {
  document.removeEventListener("DOMContentLoaded", initPopup);
})


</script>

<style>
html,
body {
  width: 300px;
  height: 400px;
  padding: 0;
  margin: 0;
}
</style>
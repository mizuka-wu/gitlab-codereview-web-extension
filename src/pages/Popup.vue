<script lang="ts" setup>
import browser from "webextension-polyfill";
import { type GitLabDetection } from "../types";
</script>

<template>
  <section class="detection-status">
    <div class="status-item">
      <span class="label">GitLab页面:</span>
      <span id="gitlab-status" class="status">检测中...</span>
    </div>
    <div class="status-item">
      <span class="label">代码审查页面:</span>
      <span id="review-status" class="status">检测中...</span>
    </div>
  </section>
</template>

<style>
html,
body {
  width: 300px;
  height: 400px;
  padding: 0;
  margin: 0;
}

</style>
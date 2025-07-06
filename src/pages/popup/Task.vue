<template>
    <div>

    </div>
</template>

<script lang="ts" setup>
import { defineModel } from 'vue'
import browser from "webextension-polyfill";
import type { AnalysisTask } from '../../types/index';

const task = defineModel<AnalysisTask | null>("task");

</script>

<style scoped></style>

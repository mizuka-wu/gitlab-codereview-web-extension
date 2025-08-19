<template>
    <div class="task-container">
        <div class="task-header">
            <h3 class="task-title">代码审查任务</h3>
            <div class="task-id">ID: {{ task?.uuid?.substring(0, 8) }}</div>
        </div>

        <div class="task-content">
            <div class="task-status">
                <div class="status-badge" :class="statusClass">{{ statusText }}</div>
                <div class="task-url" v-if="task?.mergeRequestUrl">{{ task?.mergeRequestUrl }}</div>
            </div>

            <div class="task-progress" v-if="task?.status === 'processing'">
                <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
                </div>
                <div class="progress-text">{{ progressText }}</div>
            </div>

            <div class="task-result" v-if="task?.status === 'completed'">
                <div class="result-success">
                    <NIcon :component="CheckmarkCircle" size="24" />
                    <span>代码审查已完成</span>
                </div>
            </div>

            <div class="task-error" v-if="task?.status === 'failed'">
                <div class="error-message">
                    <NIcon :component="AlertCircle" size="24" />
                    <span>审查失败: {{ errorMessage || '未知错误' }}</span>
                </div>
                <div class="debug-info" v-if="debugInfo">
                    <div class="debug-title" @click="toggleDebug">
                        <NIcon :component="CodeOutline" size="16" />
                        <span>调试信息</span>
                        <NIcon :component="showDebug ? ChevronUp : ChevronDown" size="16" />
                    </div>
                    <div class="debug-content" v-if="showDebug">
                        <pre>{{ debugInfo }}</pre>
                    </div>
                </div>
            </div>
        </div>

        <div class="task-actions">
            <NButton v-if="task?.status === 'pending' || task?.status === 'processing'" @click="startAnalysis"
                type="primary" :loading="task?.status === 'processing'" :disabled="task?.status === 'processing'">
                {{ task?.status === 'processing' ? '分析中...' : '开始分析' }}
            </NButton>
            <NButton v-if="task?.status === 'failed' || task?.status === 'completed'" @click="cancelTask"
                type="default">
                关闭
            </NButton>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import browser from "webextension-polyfill";
import { NButton, NIcon } from 'naive-ui';
import { CheckmarkCircle, AlertCircle, Code as CodeOutline, ChevronDown, ChevronUp } from '@vicons/ionicons5';
import type { AnalysisTask } from '../../types/index';
import GitlabProxyManager from '../../task/gitlab-proxy';
import { generateReview } from '../../task/agent';

const task = defineModel<AnalysisTask | null>();
const progress = ref(0);
const progressText = ref('准备中...');
const errorMessage = ref('');
const debugInfo = ref('');
const showDebug = ref(false);

// 切换调试信息显示
function toggleDebug() {
    showDebug.value = !showDebug.value;
}

// 简单根据文件扩展名猜测编程语言
function guessLanguage(filePath: string): string {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    switch (ext) {
        case 'ts': return 'TypeScript';
        case 'tsx': return 'TSX';
        case 'js': return 'JavaScript';
        case 'jsx': return 'JSX';
        case 'vue': return 'Vue';
        case 'py': return 'Python';
        case 'java': return 'Java';
        case 'kt': return 'Kotlin';
        case 'go': return 'Go';
        case 'rs': return 'Rust';
        case 'rb': return 'Ruby';
        case 'php': return 'PHP';
        case 'cs': return 'C#';
        case 'cpp':
        case 'cc':
        case 'cxx': return 'C++';
        case 'c': return 'C';
        case 'h': return 'C/C Header';
        case 'css': return 'CSS';
        case 'scss': return 'SCSS';
        case 'md': return 'Markdown';
        case 'yaml':
        case 'yml': return 'YAML';
        case 'json': return 'JSON';
        default: return '';
    }
}

// 计算任务状态对应的样式和文本
const statusClass = computed(() => {
    if (!task.value) return '';

    switch (task.value.status) {
        case 'pending': return 'status-pending';
        case 'processing': return 'status-processing';
        case 'completed': return 'status-completed';
        case 'failed': return 'status-failed';
        default: return '';
    }
});

const statusText = computed(() => {
    if (!task.value) return '';

    switch (task.value.status) {
        case 'pending': return '等待中';
        case 'processing': return '处理中';
        case 'completed': return '已完成';
        case 'failed': return '失败';
        default: return '';
    }
});

// 取消任务
function cancelTask() {
    task.value = null;
}

// 开始分析任务
async function startAnalysis() {
    if (!task.value || task.value.status === 'processing') return;

    try {
        // 获取当前活动标签页
        const tabs = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        const currentTab = tabs[0];

        if (!currentTab || !currentTab.url) {
            throw new Error('无法获取当前页面信息');
        }

        // 更新任务状态和URL
        if (task.value) {
            task.value.status = 'processing';
            task.value.mergeRequestUrl = currentTab.url;
        }

        // 模拟分析流程
        await runAnalysisTask();

    } catch (error) {
        console.error('分析失败:', error);
        if (task.value) {
            task.value.status = 'failed';
            errorMessage.value = error instanceof Error ? error.message : '未知错误';
        }
    }
}

// 通过 content script 代理执行任务流程
async function runAnalysisTask() {
    if (!task.value || !task.value.mergeRequestUrl) return;

    try {
        // 初始化GitLab代理管理器
        const gitlabManager = new GitlabProxyManager({
            mrUrl: task.value.mergeRequestUrl
        });

        // 获取变更
        progress.value = 10;
        progressText.value = '正在获取代码变更...';
        const { changes, ref } = await gitlabManager.getChanges();

        if (!changes || changes.length === 0) {
            throw new Error('没有找到代码变更');
        }

        progress.value = 30;
        progressText.value = `找到 ${changes.length} 个代码变更，准备分析...`;

        // 模拟AI分析过程
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            progress.value = 30 + Math.floor((i / changes.length) * 60);
            progressText.value = `正在分析 ${i + 1}/${changes.length}: ${change.new_path}`;

            // 使用真实 AI 调用生成代码审查内容
            const message = await generateReview({
                diff: change.diff,
                language: guessLanguage(change.new_path || change.old_path || ''),
                context: ''
            });

            // 通过代理提交评论
            await gitlabManager.codeReview({
                change,
                message,
                ref
            });
        }

        // 完成
        progress.value = 100;
        progressText.value = '分析完成';

        if (task.value) {
            task.value.status = 'completed';
        }

    } catch (error) {
        console.error('任务执行失败:', error);
        if (task.value) {
            task.value.status = 'failed';

            // 捕获错误信息
            if (error instanceof Error) {
                errorMessage.value = error.message;
            } else if (typeof error === 'object' && error !== null) {
                // 处理axios错误
                const axiosError = error as any;
                if (axiosError.response) {
                    errorMessage.value = `Request failed with status code ${axiosError.response.status}`;
                    // 保存调试信息
                    debugInfo.value = JSON.stringify({
                        status: axiosError.response.status,
                        statusText: axiosError.response.statusText,
                        headers: axiosError.response.headers,
                        data: axiosError.response.data,
                        config: {
                            url: axiosError.config?.url,
                            method: axiosError.config?.method,
                            headers: axiosError.config?.headers,
                            withCredentials: axiosError.config?.withCredentials
                        }
                    }, null, 2);
                } else if (axiosError.request) {
                    errorMessage.value = '服务器没有响应';
                    debugInfo.value = JSON.stringify({
                        request: '请求已发送但没有收到响应',
                        config: axiosError.config
                    }, null, 2);
                } else {
                    errorMessage.value = axiosError.message || '未知错误';
                    debugInfo.value = JSON.stringify(error, null, 2);
                }
            } else {
                errorMessage.value = '未知错误';
                debugInfo.value = JSON.stringify(error, null, 2);
            }
        }
    }
}

// 在组件挂载时，如果任务状态是pending，自动开始分析
onMounted(() => {
    if (task.value && task.value.status === 'pending') {
        startAnalysis();
    }
});
</script>

<style scoped>
.task-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background-color: var(--n-card-color);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.task-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--n-text-color);
}

.task-id {
    font-size: 12px;
    color: var(--n-text-color-3);
    font-family: monospace;
}

.task-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.task-status {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    width: fit-content;
}

.status-pending {
    background-color: rgba(96, 125, 139, 0.1);
    color: #607d8b;
}

.status-processing {
    background-color: rgba(33, 150, 243, 0.1);
    color: #2196f3;
    animation: pulse 1.5s infinite;
}

.status-completed {
    background-color: rgba(76, 175, 80, 0.1);
    color: #4caf50;
}

.status-failed {
    background-color: rgba(244, 67, 54, 0.1);
    color: #f44336;
}

@keyframes pulse {
    0% {
        opacity: 0.6;
    }

    50% {
        opacity: 1;
    }

    100% {
        opacity: 0.6;
    }
}

.task-url {
    font-size: 12px;
    color: var(--n-text-color-3);
    word-break: break-all;
    margin-top: 4px;
}

.task-progress {
    margin: 12px 0;
}

.progress-bar {
    height: 6px;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
}

.progress-fill {
    height: 100%;
    background-color: #2196f3;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.progress-text {
    font-size: 12px;
    color: var(--n-text-color-2);
}

.task-result {
    padding: 12px;
    background-color: rgba(76, 175, 80, 0.05);
    border-radius: 6px;
}

.result-success {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #4caf50;
    font-weight: 500;
}

.task-error {
    padding: 12px;
    background-color: rgba(244, 67, 54, 0.05);
    border-radius: 6px;
}

.error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #f44336;
    font-weight: 500;
}

.task-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
    gap: 8px;
}

.debug-info {
    margin-top: 12px;
    border: 1px solid rgba(244, 67, 54, 0.2);
    border-radius: 4px;
    overflow: hidden;
}

.debug-title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: rgba(244, 67, 54, 0.05);
    cursor: pointer;
    font-size: 12px;
    color: #f44336;
}

.debug-content {
    padding: 12px;
    background-color: rgba(0, 0, 0, 0.03);
    overflow: auto;
    max-height: 200px;
}

.debug-content pre {
    margin: 0;
    font-family: monospace;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
    color: #666;
}
</style>

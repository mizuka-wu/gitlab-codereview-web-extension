<template>
    <div class="task-container">
        <div class="task-header">
            <h3 class="task-title">{{ $t('popup.task.title') }}</h3>
            <div class="task-id">{{ $t('popup.task.id') }}: {{ task?.uuid?.substring(0, 8) }}</div>
        </div>

        <div class="task-content">
            <div class="task-status">
                <div>{{ $t('popup.task.keepPageOpen') }}</div>
                <div class="status-badge" :class="statusClass">{{ statusText }}</div>
                <div class="task-url" v-if="task?.mergeRequestUrl">{{ task?.mergeRequestUrl }}</div>
                <div class="skipped-info" v-if="skippedCount > 0">
                    {{ $t('popup.task.skippedNoSuggestionCount', { count: skippedCount }) }}
                </div>
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
                    <span>{{ $t('popup.task.reviewCompleted') }}</span>
                </div>
            </div>

            <div class="task-error" v-if="task?.status === 'failed'">
                <div class="error-message">
                    <NIcon :component="AlertCircle" size="24" />
                    <span>{{ $t('popup.task.reviewFailed') }}: {{ errorMessage || $t('common.unknownError') }}</span>
                </div>
                <div class="debug-info" v-if="debugInfo">
                    <div class="debug-title" @click="toggleDebug">
                        <NIcon :component="CodeOutline" size="16" />
                        <span>{{ $t('popup.task.debugInfo') }}</span>
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
                {{ task?.status === 'processing' ? $t('popup.task.analyzing') : $t('popup.startAnalysis') }}
            </NButton>
            <NButton v-if="task?.status === 'failed' && showGoToSettings" @click="goToOptions" type="default">
                {{ $t('popup.settings') }}
            </NButton>
            <NButton v-if="task?.status === 'failed' || task?.status === 'completed'" @click="cancelTask"
                type="default">
                {{ $t('common.close') }}
            </NButton>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n';
import browser from "webextension-polyfill";
import { NButton, NIcon } from 'naive-ui';
import { CheckmarkCircle, AlertCircle, Code as CodeOutline, ChevronDown, ChevronUp } from '@vicons/ionicons5';
import type { AnalysisTask } from '../../types/index';
import GitlabProxyManager from '../../task/gitlab-proxy';
import { generateReview } from '../../task/agent';
import { isOllamaModelAvailable } from '../../task/agent/agent';
import { DEFAULT_OLLAMA_END_POINT } from '../../constants';
import { stripThinkTags, isNoSuggestionMessage } from '../../utils/review';

const { t } = useI18n();

const task = defineModel<AnalysisTask | null>();
const progress = ref(0);
const progressText = ref(t('popup.task.preparing'));
const errorMessage = ref('');
const debugInfo = ref('');
const showDebug = ref(false);
const showGoToSettings = ref(false);
const skippedCount = ref(0);

// 切换调试信息显示
function toggleDebug() {
    showDebug.value = !showDebug.value;
}

// stripThinkTags / isNoSuggestionMessage 改为使用公共工具模块

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

// 预检：检查是否配置并安装可用的 AI 模型
async function precheckModel(): Promise<boolean> {
    try {
        showGoToSettings.value = false;
        errorMessage.value = '';

        const data = await browser.storage.local.get('settings');
        const settings: any = data?.settings ?? {};
        const currentAgent = settings?.aiAgent?.current ?? 'ollama';

        // 根据不同的AI代理类型进行不同的检查
        switch (currentAgent) {
            case 'ollama': {
                const endpoint: string = settings?.aiAgent?.aiAgentConfig?.ollama?.endpoint ?? DEFAULT_OLLAMA_END_POINT;
                const model: string = settings?.aiAgent?.aiAgentConfig?.ollama?.model ?? '';

                if (!model) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = t('popup.task.noModelConfigured');
                    debugInfo.value = JSON.stringify({ endpoint, model }, null, 2);
                    return false;
                }

                const available = await isOllamaModelAvailable(endpoint, model).catch(() => false);
                if (!available) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = t('popup.task.modelUnavailable', { model });
                    debugInfo.value = JSON.stringify({ endpoint, model, available }, null, 2);
                    return false;
                }
                break;
            }

            case 'openai': {
                const config = settings?.aiAgent?.aiAgentConfig?.openai ?? {};
                const apiKey = config.apiKey;
                const model = config.model;

                if (!apiKey) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = '未配置 OpenAI API Key，请前往设置页配置';
                    debugInfo.value = JSON.stringify({ model, hasApiKey: !!apiKey }, null, 2);
                    return false;
                }

                if (!model) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = t('popup.task.noOpenAIModelConfigured');
                    debugInfo.value = JSON.stringify({ model, hasApiKey: !!apiKey }, null, 2);
                    return false;
                }
                break;
            }

            case 'claude': {
                const config = settings?.aiAgent?.aiAgentConfig?.claude ?? {};
                const apiKey = config.apiKey;
                const model = config.model;

                if (!apiKey) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = '未配置 Claude API Key，请前往设置页配置';
                    debugInfo.value = JSON.stringify({ model, hasApiKey: !!apiKey }, null, 2);
                    return false;
                }

                if (!model) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = t('popup.task.noClaudeModelConfigured');
                    debugInfo.value = JSON.stringify({ model, hasApiKey: !!apiKey }, null, 2);
                    return false;
                }
                break;
            }

            case 'openapi': {
                const config = settings?.aiAgent?.aiAgentConfig?.openapi ?? {};
                const baseUrl = config.baseUrl;
                const model = config.model;

                if (!baseUrl) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = '未配置 OpenAPI 兼容服务地址，请前往设置页配置';
                    debugInfo.value = JSON.stringify({ baseUrl, model }, null, 2);
                    return false;
                }

                if (!model) {
                    if (task.value) task.value.status = 'failed';
                    showGoToSettings.value = true;
                    errorMessage.value = t('popup.task.noOpenAPIModelConfigured');
                    debugInfo.value = JSON.stringify({ baseUrl, model }, null, 2);
                    return false;
                }
                break;
            }

            default: {
                if (task.value) task.value.status = 'failed';
                showGoToSettings.value = true;
                errorMessage.value = `不支持的AI代理类型: ${currentAgent}`;
                debugInfo.value = JSON.stringify({ currentAgent }, null, 2);
                return false;
            }
        }

        return true;
    } catch (e) {
        if (task.value) task.value.status = 'failed';
        showGoToSettings.value = true;
        errorMessage.value = (e as Error)?.message || t('popup.task.precheckFailed');
        debugInfo.value = JSON.stringify(e, null, 2);
        return false;
    }
}

function goToOptions() {
    try {
        browser.runtime.openOptionsPage();
    } catch { }
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
        case 'pending': return t('popup.task.status.pending');
        case 'processing': return t('popup.task.status.processing');
        case 'completed': return t('popup.task.status.completed');
        case 'failed': return t('popup.task.status.failed');
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
            throw new Error(t('popup.task.noActivePage'));
        }

        // 预检模型可用性
        const ok = await precheckModel();
        if (!ok) return;

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
        progressText.value = t('popup.task.fetchingChanges');
        const { changes, ref } = await gitlabManager.getChanges();

        if (!changes || changes.length === 0) {
            throw new Error(t('popup.task.noChangesFound'));
        }

        progress.value = 30;
        progressText.value = t('popup.task.foundChanges', { count: changes.length });
        skippedCount.value = 0;

        // 模拟AI分析过程
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            progress.value = 30 + Math.floor((i / changes.length) * 60);
            progressText.value = t('popup.task.analyzingItem', { index: i + 1, total: changes.length, file: change.new_path });

            // 使用真实 AI 调用生成代码审查内容
            const message = await generateReview({
                diff: change.diff,
                language: guessLanguage(change.new_path || change.old_path || ''),
                context: ''
            });

            // 若 AI 表示“无建议”，跳过创建讨论
            const sanitized = stripThinkTags(message);
            if (isNoSuggestionMessage(sanitized)) {
                console.log('AI 返回无建议，跳过当前文件讨论:', change.new_path || change.old_path);
                skippedCount.value++;
                continue;
            }

            // 通过代理提交评论
            const res = await gitlabManager.codeReview({
                change,
                message,
                ref
            });
            if (res && (((res as any).skipped) || ((res as any).data && (res as any).data.skipped))) {
                skippedCount.value++;
            }
        }

        // 完成
        progress.value = 100;
        progressText.value = t('popup.task.analysisDone');

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
                    errorMessage.value = t('popup.task.requestFailedWithStatus', { status: axiosError.response.status });
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
                    errorMessage.value = t('popup.task.noServerResponse');
                    debugInfo.value = JSON.stringify({
                        request: '请求已发送但没有收到响应',
                        config: axiosError.config
                    }, null, 2);
                } else {
                    errorMessage.value = axiosError.message || t('common.unknownError');
                    debugInfo.value = JSON.stringify(error, null, 2);
                }
            } else {
                errorMessage.value = t('common.unknownError');
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

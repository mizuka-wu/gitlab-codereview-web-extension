import browser from "webextension-polyfill";
import { type GitLabDetection, type Settings } from "./types/index.d";
import { DEFAUTL_PROMPT } from "./constants";

console.log("Gitlab Codereview Web Extension Start!");

// 存储GitLab API和差异引用信息
let gitlabApiInfo: {
  api: any;
  ref: any;
} | null = null;

// 数据迁移：从 sync 存储迁移到 local 存储
async function migrateStorageData() {
  try {
    // 检查是否已经迁移过
    const migrationCheck = await browser.storage.local.get('_migrated_to_local');
    if (migrationCheck._migrated_to_local) {
      console.log('数据已迁移到本地存储');
      return;
    }

    // 尝试从 sync 存储读取现有数据
    const syncData = await browser.storage.sync.get(['settings', 'gitlabDetection']);
    
    if (syncData.settings || syncData.gitlabDetection) {
      console.log('发现 sync 存储中的数据，开始迁移到 local 存储');
      
      // 迁移到 local 存储
      await browser.storage.local.set(syncData);
      
      // 标记已迁移
      await browser.storage.local.set({ _migrated_to_local: true });
      
      console.log('数据迁移完成');
    } else {
      // 没有旧数据，直接标记已迁移
      await browser.storage.local.set({ _migrated_to_local: true });
      console.log('没有发现需要迁移的数据');
    }
  } catch (error) {
    console.error('数据迁移失败:', error);
  }
}

// 扩展安装或更新时的处理
browser.runtime.onInstalled.addListener(async (details) => {
  console.log("扩展已安装或更新:", details);

  // 首先尝试数据迁移
  await migrateStorageData();

  // 检查是否已有设置，如果没有则初始化默认设置
  const existingData = await browser.storage.local.get(['settings', 'gitlabDetection']);
  
  if (!existingData.gitlabDetection) {
    // 初始化GitLab检测状态
    const defaultGitlabDetction: GitLabDetection = {
      isGitLab: false,
      isReviewPage: false,
      url: "",
      title: "",
      timestamp: Date.now(),
    };
    await browser.storage.local.set({
      gitlabDetection: defaultGitlabDetction,
    });
  }

  if (!existingData.settings) {
    // 初始化默认设置
    const defaultSettings: Settings = {
      detctor: {
        isEnable: true,
      },
      aiAgent: {
        current: "ollama",
        aiAgentConfig: {},
      },
      prompt: {
        template: DEFAUTL_PROMPT,
      },
    };
    await browser.storage.local.set({
      settings: defaultSettings,
    });
  }

  console.log('扩展初始化完成');
});

// 监听来自内容脚本的消息
browser.runtime.onMessage.addListener(async (message, sender) => {
  const tabId = sender.tab?.id;

  switch (message.action) {
    case "settingsUpdated": {
      console.log("设置已更新:", message.settings);

      // 向所有标签页广播设置更新消息
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await browser.tabs.sendMessage(tab.id, {
              action: "settingsUpdated",
              settings: message.settings,
            });
          } catch (error) {
            // 忽略无法发送消息的标签页（可能不是扩展可以访问的页面）
          }
        }
      }

      return { success: true };
    }
    case "getGitLabApiInfo": {
      console.log("收到获取GitLab API信息请求");
      if (gitlabApiInfo) {
        console.log("返回缓存的GitLab API信息");
        return gitlabApiInfo;
      } else {
        console.log("没有可用的GitLab API信息");
        return { error: "没有可用的GitLab API信息" };
      }
    }
    case "saveGitLabApiInfo": {
      console.log("保存GitLab API信息");
      gitlabApiInfo = {
        api: message.api,
        ref: message.ref,
      };
      return { success: true };
    }
    case "gitlabDetected": {
      if (!tabId) return;
      console.log("收到GitLab检测消息");
      const detectionState: GitLabDetection = {
        isGitLab: message.isGitLab,
        isReviewPage: message.isReviewPage,
        url: message.url,
        title: message.title,
        timestamp: Date.now(),
      };

      // 保存检测状态
      await browser.storage.local.set({ gitlabDetection: detectionState });

      // 更新扩展图标状态
      updateExtensionIcon(tabId, detectionState);

      console.log(`GitLab检测结果 [${tabId}]:`, detectionState);

      // 返回确认消息
      return { success: true };
    }
  }
});

// 更新扩展图标状态
async function updateExtensionIcon(tabId: number, state: GitLabDetection) {
  // 根据检测结果更新图标
  if (state.isGitLab) {
    if (state.isReviewPage) {
      // 如果是GitLab代码审查页面，使用高亮图标
      browser.action.setIcon({
        tabId,
        path: {
          16: "/icon/active/16.png",
          32: "/icon/active/32.png",
          48: "/icon/active/48.png",
          128: "/icon/active/128.png",
        },
      });
    } else {
      // 如果是普通GitLab页面，使用普通图标
      browser.action.setIcon({
        tabId,
        path: {
          16: "/icon/16.png",
          32: "/icon/32.png",
          48: "/icon/48.png",
          128: "/icon/128.png",
        },
      });
    }

    // 启用扩展按钮
    browser.action.enable(tabId);
  } else {
    // 如果不是GitLab页面，使用灰色图标
    browser.action.setIcon({
      tabId,
      path: {
        16: "/icon/inactive/16.png",
        32: "/icon/inactive/32.png",
        48: "/icon/inactive/48.png",
        128: "/icon/inactive/128.png",
      },
    });
  }
}

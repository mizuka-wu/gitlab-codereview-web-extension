import { createI18n } from "vue-i18n";
import zhCN from "./zh-CN.json";
import enUS from "./en-US.json";

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "zh-CN",
  fallbackLocale: "en-US",
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

export type LocaleKey = "zh-CN" | "en-US";

export const supportedLocales: Array<{ label: string; value: LocaleKey }> = [
  { label: "中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
];

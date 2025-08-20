import Options from "./pages/Options.vue";
import { createApp, h } from "vue";
import { NMessageProvider } from "naive-ui";
import { i18n } from "./i18n";

// 创建应用实例
const app = createApp({
  render: () => h(NMessageProvider, null, () => h(Options)),
});

// 注册 i18n
app.use(i18n);

// 挂载到 body
app.mount("body");

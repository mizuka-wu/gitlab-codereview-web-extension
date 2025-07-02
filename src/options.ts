import Options from "./pages/Options.vue";
import { createApp, h } from "vue";
import { NMessageProvider } from "naive-ui";

// 创建应用实例
const app = createApp({
  render: () => h(NMessageProvider, null, () => h(Options)),
});

// 挂载到 body
app.mount("body");

import Popup from "./pages/Popup.vue";
import { createApp } from "vue";
import { i18n } from "./i18n";

createApp(Popup)
  .use(i18n)
  .mount("body");

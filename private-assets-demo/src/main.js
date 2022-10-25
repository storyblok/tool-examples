import { createApp } from "vue";
import { StoryblokVue, apiPlugin } from "@storyblok/vue";

import App from "./App.vue";
import Page from "./components/Page.vue";
import PrivateAssetLink from "./components/PrivateAssetLink.vue";
import PrivateAssetForm from "./components/PrivateAssetForm.vue";

const app = createApp(App);

app.use(StoryblokVue, {
  accessToken: import.meta.env.VITE_STORYBLOK_PREVIEW_TOKEN,
  use: [apiPlugin],
});

app.component("PrivateAssetLink", PrivateAssetLink);
app.component("PrivateAssetForm", PrivateAssetForm);
app.component("Page", Page);

app.mount("#app");

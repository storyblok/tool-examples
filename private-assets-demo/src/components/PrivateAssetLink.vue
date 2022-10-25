<template>
  <a
    :href="privateAssetURL"
    target="_blank"
    rel="noopener noreferrer"
    class="private-asset-link"
  >
    Download private asset
  </a>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ assetFilename: String });

const privateAssetURL = computed(
  () =>
    `${import.meta.env.VITE_SERVERLESS_BASE_PATH}${
      import.meta.env.VITE_SERVERLESS_DOWNLOAD_PRIVATE_ASSET_ENDPOINT
    }?assetURL=${props.assetFilename}`
);
</script>

<style scoped>
.private-asset-link {
  font-family: Arial, Helvetica, sans-serif;
  color: darkcyan;
  text-decoration: none;
  transition: all 0.3s;
}

.private-asset-link:hover {
  color: darkslateblue;
  text-decoration: underline;
}
</style>

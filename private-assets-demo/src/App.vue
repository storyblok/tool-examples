<script setup>
import PrivateAssetPage from "./pages/PrivateAssetPage.vue";
</script>

<template>
  <Suspense>
    <template #default>
      <PrivateAssetPage />
    </template>

    <template #fallback>
      <div>Loading...</div>
    </template>
  </Suspense>
</template>

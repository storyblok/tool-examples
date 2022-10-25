<template>
  <div v-editable="blok" class="page">
    <StoryblokComponent
      v-for="blok in blok.body"
      :blok="blok"
      :key="blok._uid"
    />
  </div>
</template>

<script setup>
defineProps({ blok: Object });
</script>

<style scoped>
.page {
  padding: 1rem;
}
</style>

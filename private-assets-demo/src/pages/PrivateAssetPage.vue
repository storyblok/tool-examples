<script setup>
import { useStoryblok } from "@storyblok/vue";

const story = await useStoryblok("private-asset-page", { version: "draft" });
</script>

<template>
  <StoryblokComponent v-if="story" :blok="story.content" />
</template>

<script setup lang="ts">
/**
 * PreviewImage - Image preview component
 * @description Displays an image with proper styling and shadow
 */
defineProps<{
  /** Image source URL */
  src: string
  /** Alt text for accessibility */
  alt?: string
}>()
</script>

<template>
  <div class="h-full flex items-center justify-center">
    <img
      :src="src"
      :alt="alt || '剪贴图片预览'"
      class="max-w-full w-full rounded-3 object-contain"
    >
  </div>
</template>

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
  <div class="flex items-center justify-center">
    <img
      :src="src"
      :alt="alt || '剪贴图片预览'"
      class="max-w-full rounded-3 shadow-[var(--clipboard-shadow-soft,0_8px_20px_rgba(15,23,42,0.12))]"
    >
  </div>
</template>

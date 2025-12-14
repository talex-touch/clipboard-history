<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * PreviewImage - Image preview component with progressive loading
 * @description Displays thumbnail first, then loads full resolution image with smooth transition
 */
const props = defineProps<{
  /** Thumbnail source (low resolution, fast load) */
  thumbnail?: string
  /** Full resolution image source */
  src: string
  /** Alt text for accessibility */
  alt?: string
}>()

const hdLoaded = ref(false)
const hdSrc = ref('')

// Watch for item changes to reset and trigger progressive loading
watch(
  () => props.src,
  (newSrc) => {
    hdLoaded.value = false
    hdSrc.value = ''

    if (!newSrc || !props.thumbnail || newSrc === props.thumbnail) {
      // No progressive loading needed
      hdLoaded.value = true
      return
    }

    // Preload full resolution image
    const img = new Image()
    img.onload = () => {
      hdSrc.value = newSrc
      hdLoaded.value = true
    }
    img.onerror = () => {
      // Fallback to thumbnail on error
      hdLoaded.value = true
    }
    img.src = newSrc
  },
  { immediate: true },
)

// Determine which image to display
const displaySrc = computed(() => {
  if (hdLoaded.value && hdSrc.value) {
    return hdSrc.value
  }
  return props.thumbnail || props.src
})

const isLoadingHD = computed(() => {
  return props.thumbnail && props.src !== props.thumbnail && !hdLoaded.value
})
</script>

<template>
  <div class="progressive-image h-full flex items-center justify-center">
    <div class="image-container relative">
      <img
        :src="displaySrc"
        :alt="alt || '剪贴图片预览'"
        class="preview-img max-w-full w-full rounded-3 object-contain transition-all duration-300"
        :class="{ 'is-thumbnail': isLoadingHD }"
      >
      <!-- Loading indicator -->
      <div v-if="isLoadingHD" class="loading-indicator">
        <span class="i-carbon-image text-lg opacity-60" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  max-height: 100%;
}

.preview-img.is-thumbnail {
  filter: blur(2px);
  transform: scale(1.02);
}

.loading-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
</style>

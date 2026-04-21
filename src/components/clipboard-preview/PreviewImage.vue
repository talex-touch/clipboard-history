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
  /** Whether only a thumbnail source is currently available */
  thumbnailOnly?: boolean
  /** Alt text for accessibility */
  alt?: string
}>()

const hdLoaded = ref(false)
const hdSrc = ref('')
const fallbackReason = ref<'timeout' | 'error' | ''>('')
const loadRequestId = ref(0)

function debugLog(stage: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  if (meta)
    // eslint-disable-next-line no-console
    console.debug(`[PreviewImage][${ts}] ${stage}`, meta)
  else
    // eslint-disable-next-line no-console
    console.debug(`[PreviewImage][${ts}] ${stage}`)
}

// Watch for item changes to reset and trigger progressive loading
watch(
  () => [props.src, props.thumbnail] as const,
  ([newSrc, newThumbnail]) => {
    const requestId = ++loadRequestId.value
    hdLoaded.value = false
    hdSrc.value = ''
    fallbackReason.value = ''

    debugLog('load:start', {
      requestId,
      hasSrc: Boolean(newSrc),
      hasThumbnail: Boolean(newThumbnail),
      sameSource: newSrc === newThumbnail,
    })

    if (!newSrc || !newThumbnail || newSrc === newThumbnail) {
      hdLoaded.value = true
      debugLog('load:skip', { requestId })
      return
    }

    // Preload full resolution image
    const img = new Image()
    const loadTimeout = setTimeout(() => {
      if (requestId !== loadRequestId.value)
        return
      hdLoaded.value = true
      fallbackReason.value = 'timeout'
      debugLog('load:timeout', { requestId, source: newSrc.slice(0, 96) })
    }, 2500)
    img.onload = () => {
      if (requestId !== loadRequestId.value)
        return
      clearTimeout(loadTimeout)
      hdSrc.value = newSrc
      hdLoaded.value = true
      fallbackReason.value = ''
      debugLog('load:success', { requestId, source: newSrc.slice(0, 96) })
    }
    img.onerror = () => {
      if (requestId !== loadRequestId.value)
        return
      clearTimeout(loadTimeout)
      hdLoaded.value = true
      fallbackReason.value = 'error'
      debugLog('load:error', { requestId, source: newSrc.slice(0, 96) })
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
  return Boolean(props.thumbnail && props.src !== props.thumbnail && !hdLoaded.value)
})

const isShowingFallback = computed(() => {
  return Boolean(
    props.thumbnail
    && (
      props.thumbnailOnly
      || (props.src && props.src !== props.thumbnail && fallbackReason.value)
    ),
  )
})

const fallbackText = computed(() => {
  if (props.thumbnailOnly)
    return '原图暂不可用，正在显示缩略图'
  return fallbackReason.value === 'timeout'
    ? '原图加载超时，正在显示缩略图'
    : '原图加载失败，正在显示缩略图'
})
</script>

<template>
  <div class="progressive-image h-full flex items-center justify-center">
    <div class="image-container relative">
      <img
        :src="displaySrc"
        :alt="alt || '剪贴图片预览'"
        class="preview-img max-w-full w-full rounded-3 object-contain transition-all duration-300"
      >
      <div v-if="isLoadingHD" class="loading-indicator">
        <span class="i-carbon-image text-lg opacity-60" />
        <span>加载原图中</span>
      </div>
      <div v-else-if="isShowingFallback" class="fallback-indicator">
        <span class="i-carbon-warning-alt text-lg opacity-75" />
        <span>{{ fallbackText }}</span>
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

.loading-indicator,
.fallback-indicator {
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
}

.loading-indicator {
  animation: pulse 1.5s ease-in-out infinite;
}

.fallback-indicator {
  max-width: calc(100% - 16px);
  background: rgba(0, 0, 0, 0.64);
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

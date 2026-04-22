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

const currentSrc = ref('')
const currentRequestId = ref(0)
const imageLoaded = ref(false)
const fallbackReason = ref<'error' | ''>('')

function debugLog(stage: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  if (meta)
    // eslint-disable-next-line no-console
    console.debug(`[PreviewImage][${ts}] ${stage}`, meta)
  else
    // eslint-disable-next-line no-console
    console.debug(`[PreviewImage][${ts}] ${stage}`)
}

function resolvePreferredSrc(): string {
  if (props.thumbnailOnly)
    return props.thumbnail || props.src
  return props.src || props.thumbnail || ''
}

watch(
  () => [props.src, props.thumbnail, props.thumbnailOnly] as const,
  ([newSrc, newThumbnail, thumbnailOnly]) => {
    currentRequestId.value += 1
    currentSrc.value = resolvePreferredSrc()
    imageLoaded.value = false
    fallbackReason.value = ''

    debugLog('load:start', {
      requestId: currentRequestId.value,
      hasSrc: Boolean(newSrc),
      hasThumbnail: Boolean(newThumbnail),
      sameSource: newSrc === newThumbnail,
      thumbnailOnly,
      currentSrc: currentSrc.value.slice(0, 96),
    })
  },
  { immediate: true },
)

function handleLoad() {
  imageLoaded.value = true
  debugLog('load:success', {
    requestId: currentRequestId.value,
    source: currentSrc.value.slice(0, 96),
  })
}

function handleError() {
  const failedSrc = currentSrc.value
  const thumbnail = props.thumbnail || ''
  const canFallbackToThumbnail = Boolean(
    thumbnail
    && failedSrc
    && thumbnail !== failedSrc,
  )

  if (canFallbackToThumbnail) {
    currentSrc.value = thumbnail
    imageLoaded.value = false
    fallbackReason.value = 'error'
    debugLog('load:fallback-thumbnail', {
      requestId: currentRequestId.value,
      failedSource: failedSrc.slice(0, 96),
      thumbnail: thumbnail.slice(0, 96),
    })
    return
  }

  imageLoaded.value = true
  fallbackReason.value = 'error'
  debugLog('load:error', {
    requestId: currentRequestId.value,
    source: failedSrc.slice(0, 96),
  })
}

const isLoadingHD = computed(() => {
  return Boolean(
    props.thumbnail
    && props.src
    && props.src !== props.thumbnail
    && currentSrc.value === props.src
    && !imageLoaded.value,
  )
})

const isShowingFallback = computed(() => {
  return Boolean(
    props.thumbnail
    && (
      props.thumbnailOnly
      || (currentSrc.value === props.thumbnail && fallbackReason.value)
    ),
  )
})

const fallbackText = computed(() => {
  if (props.thumbnailOnly)
    return '原图暂不可用，正在显示缩略图'
  return '原图加载失败，正在显示缩略图'
})
</script>

<template>
  <div class="progressive-image h-full flex items-center justify-center">
    <div class="image-container relative">
      <img
        :key="currentSrc"
        :src="currentSrc"
        :alt="alt || '剪贴图片预览'"
        class="preview-img max-w-full w-full rounded-3 object-contain transition-all duration-300"
        @load="handleLoad"
        @error="handleError"
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

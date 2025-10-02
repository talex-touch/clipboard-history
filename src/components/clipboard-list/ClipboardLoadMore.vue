<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  canLoadMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
}>()

const emit = defineEmits<{
  (event: 'loadMore'): void
}>()

const sentinelRef = ref<HTMLDivElement | null>(null)
let observer: IntersectionObserver | null = null

function getObserverRoot(): Element | null {
  const parent = sentinelRef.value?.parentElement ?? null
  return parent instanceof Element ? parent : null
}

function teardownObserver() {
  if (!observer)
    return
  observer.disconnect()
  observer = null
}

function triggerLoadMore() {
  if (props.isLoading || props.isLoadingMore || !props.canLoadMore)
    return

  teardownObserver()
  emit('loadMore')
}

function setupObserver() {
  if (!sentinelRef.value)
    return

  teardownObserver()

  const root = getObserverRoot()

  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        triggerLoadMore()
        break
      }
    }
  }, {
    root,
    rootMargin: '220px 0px 480px',
    threshold: 0.05,
  })

  observer.observe(sentinelRef.value)
}

watch(
  () => [props.canLoadMore, props.isLoading, props.isLoadingMore],
  async () => {
    const shouldObserve = props.canLoadMore && !props.isLoading && !props.isLoadingMore

    if (!shouldObserve) {
      teardownObserver()
      return
    }

    await nextTick()
    setupObserver()
  },
  { immediate: true },
)

watch(
  () => sentinelRef.value,
  (element) => {
    if (!element) {
      teardownObserver()
      return
    }

    if (props.canLoadMore && !props.isLoading && !props.isLoadingMore)
      setupObserver()
  },
)

onBeforeUnmount(() => {
  teardownObserver()
})
</script>

<template>
  <div
    v-if="canLoadMore && !isLoading"
    ref="sentinelRef"
    class="load-more w-full"
    role="status"
    :aria-busy="isLoadingMore ? 'true' : 'false'"
  >
    <svg class="spinner" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="spinner-track" cx="24" cy="24" r="20" />
      <circle class="spinner-head" cx="24" cy="24" r="20" />
    </svg>
    <span class="spinner-label">{{ isLoadingMore ? '加载中…' : '继续向下滑动以加载更多' }}</span>
  </div>
</template>

<style scoped>
.load-more {
  align-self: center;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px 24px 36px;
  gap: 10px;
  color: var(--clipboard-text-secondary);
}

.spinner {
  width: 42px;
  height: 42px;
  animation: rotate 1.2s linear infinite;
}

.spinner-track {
  fill: none;
  stroke-width: 4;
  stroke: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 18%, transparent);
}

.spinner-head {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  stroke: var(--clipboard-color-accent, #6366f1);
  stroke-dasharray: 90 150;
  stroke-dashoffset: 0;
  animation: dash 1.2s ease-in-out infinite;
}

.spinner-label {
  font-size: 0.8rem;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
</style>

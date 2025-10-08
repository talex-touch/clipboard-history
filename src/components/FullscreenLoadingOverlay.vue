<script setup lang="ts">
import SyncIndicator from './SyncIndicator.vue'

const props = withDefaults(defineProps<{
  label?: string
}>(), {
  label: '正在同步…',
})
</script>

<template>
  <div class="FullscreenLoadingOverlay" role="status" aria-live="assertive">
    <SyncIndicator :label="props.label" size="lg" />
  </div>
</template>

<style scoped>
.FullscreenLoadingOverlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--clipboard-surface-base, #0f172a) 32%, transparent);
  backdrop-filter: blur(14px);
  pointer-events: auto;
}

.FullscreenLoadingOverlay :deep(.SyncIndicator) {
  color: var(--clipboard-text-primary);
}
</style>

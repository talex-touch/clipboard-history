<script setup lang="ts">
const props = defineProps<{
  canLoadMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
}>()

const emit = defineEmits<{
  (event: 'loadMore'): void
}>()

function handleClick() {
  if (!props.isLoading && props.canLoadMore && !props.isLoadingMore)
    emit('loadMore')
}
</script>

<template>
  <button
    v-if="canLoadMore && !isLoading"
    class="ghost-button load-more"
    type="button"
    :disabled="isLoadingMore"
    @click="handleClick"
  >
    <span class="i-carbon-chevron-down" aria-hidden="true" />
    {{ isLoadingMore ? '加载中…' : '加载更多' }}
  </button>
</template>

<style scoped>
.ghost-button.load-more {
  align-self: center;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-subtle);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--clipboard-text-secondary);
  cursor: pointer;
  transition: all 0.18s ease;
}

.ghost-button.load-more:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 12%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  box-shadow: var(--clipboard-shadow-ghost);
}

.ghost-button.load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  color: var(--clipboard-text-disabled);
}

.ghost-button.load-more span[aria-hidden='true'] {
  font-size: 0.95rem;
}
</style>

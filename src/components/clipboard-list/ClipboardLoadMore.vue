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
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.75);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.18s ease;
}

.ghost-button.load-more:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.18);
}

.ghost-button.load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost-button.load-more span[aria-hidden='true'] {
  font-size: 0.95rem;
}
</style>

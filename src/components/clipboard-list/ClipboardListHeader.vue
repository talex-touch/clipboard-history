<script setup lang="ts">
import { computed } from 'vue'
import SyncIndicator from '~/components/SyncIndicator.vue'

const props = defineProps<{
  summaryText: string
  isLoading: boolean
  activeFilterLabel: string
  hasActiveFilter: boolean
  hasItems: boolean
  multiSelectMode: boolean
  multiSelectedCount: number
}>()

const emit = defineEmits<{
  (event: 'toggleFilter'): void
  (event: 'refresh'): void
  (event: 'toggleMultiSelect'): void
}>()

function handleToggleFilter() {
  emit('toggleFilter')
}
function handleRefresh() {
  if (!props.isLoading)
    emit('refresh')
}

function handleToggleMultiSelect() {
  if (!props.hasItems && !props.multiSelectMode)
    return
  emit('toggleMultiSelect')
}

const multiSelectLabel = computed(() => {
  if (props.multiSelectMode) {
    const suffix = props.multiSelectedCount > 0 ? ` (${props.multiSelectedCount})` : ''
    return `退出多选${suffix}`
  }
  return '多选'
})
</script>

<template>
  <header class="header-root flex items-center justify-between gap-2 text-sm">
    <div class="header-title">
      <p>
        {{ summaryText }}
      </p>
    </div>
    <div class="inline-flex items-center gap-2">
      <button
        class="filter-toggle inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition"
        :class="{ active: hasActiveFilter }"
        type="button"
        @click="handleToggleFilter"
      >
        <span class="i-carbon-filter text-sm" aria-hidden="true" />
        {{ activeFilterLabel }}
      </button>
      <SyncIndicator v-if="isLoading" size="sm" />
      <button
        class="icon-button"
        type="button"
        :disabled="isLoading"
        @click="handleRefresh"
      >
        <span class="i-carbon-renew block" aria-hidden="true" />
      </button>
      <button
        class="multi-select-toggle inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition"
        :class="{ active: multiSelectMode }"
        type="button"
        :disabled="!hasItems && !multiSelectMode"
        @click="handleToggleMultiSelect"
      >
        <span :class="multiSelectMode ? 'i-carbon-checkbox-checked-filled' : 'i-carbon-checkbox-multiple'" aria-hidden="true" />
        {{ multiSelectLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.header-root {
  color: var(--clipboard-text-secondary);
}

.header-title p {
  margin: 0;
  color: var(--clipboard-text-secondary);
  font-weight: 600;
}

.filter-toggle,
.multi-select-toggle {
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-subtle);
  color: var(--clipboard-text-secondary);
}

.filter-toggle:hover,
.multi-select-toggle:hover {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-softer-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 8%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.filter-toggle.active,
.multi-select-toggle.active {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 14%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.multi-select-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-button {
  border: 1px solid transparent;
  background: transparent;
  color: var(--clipboard-text-muted);
  border-radius: 999px;
  padding: 6px;
  transition: all 0.18s ease;
}

.icon-button:hover:not(:disabled) {
  border-color: var(--clipboard-border-color);
  background: var(--clipboard-surface-strong);
  color: var(--clipboard-text-secondary);
}

.icon-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.icon-button span {
  display: block;
}
</style>

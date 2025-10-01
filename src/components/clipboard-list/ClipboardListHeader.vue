<script setup lang="ts">
const props = defineProps<{
  summaryText: string
  isLoading: boolean
  activeFilterLabel: string
  hasActiveFilter: boolean
  isClearing: boolean
  hasItems: boolean
}>()

const emit = defineEmits<{
  (event: 'toggleFilter'): void
  (event: 'refresh'): void
  (event: 'clear'): void
}>()

function handleToggleFilter() {
  emit('toggleFilter')
}
function handleRefresh() {
  if (!props.isLoading)
    emit('refresh')
}

function handleClear() {
  if (!props.isClearing && props.hasItems)
    emit('clear')
}
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
      <div v-if="isLoading" class="sync-indicator inline-flex items-center gap-1.5 text-xs">
        <span class="spinner h-3 w-3 animate-spin border-2 rounded-full" aria-hidden="true" />
        正在同步…
      </div>
      <button
        class="icon-button"
        type="button"
        :disabled="isLoading"
        @click="handleRefresh"
      >
        <span class="i-carbon-renew block" aria-hidden="true" />
      </button>
      <button
        class="icon-button danger"
        type="button"
        :disabled="isClearing || !hasItems"
        @click="handleClear"
      >
        <span class="i-carbon-trash-can block" aria-hidden="true" />
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

.filter-toggle {
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-subtle);
  color: var(--clipboard-text-secondary);
}

.filter-toggle:hover {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-softer-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 8%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.filter-toggle.active {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 14%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.sync-indicator {
  color: var(--clipboard-text-muted);
}

.sync-indicator .spinner {
  border-color: rgba(148, 163, 184, 0.28);
  border-color: color-mix(in srgb, var(--clipboard-text-muted, #94a3b8) 36%, transparent);
  border-top-color: var(--clipboard-color-accent, #6366f1);
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

.icon-button.danger {
  color: var(--clipboard-color-danger, #ef4444);
}

.icon-button.danger:hover:not(:disabled) {
  border-color: var(--clipboard-color-danger, #ef4444);
  background: var(--clipboard-color-danger-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 14%, transparent);
}

.icon-button.danger:disabled {
  color: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 40%, transparent);
}

.icon-button span {
  display: block;
}
</style>

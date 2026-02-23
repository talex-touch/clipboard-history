<script setup lang="ts">
import { computed } from 'vue'
import SyncIndicator from '~/components/SyncIndicator.vue'
import { useCommandPalette } from '~/composables/useCommandPalette'

const props = defineProps<{
  summaryText: string
  isLoading: boolean
  activeFilterLabel: string
  hasActiveFilter: boolean
  hasItems: boolean
  multiSelectMode: boolean
  multiSelectedCount: number
  showRefresh?: boolean
  showMultiSelectToggle?: boolean
  showCommandPaletteTrigger?: boolean
}>()

const emit = defineEmits<{
  (event: 'toggleFilter'): void
  (event: 'refresh'): void
  (event: 'toggleMultiSelect'): void
}>()

const palette = useCommandPalette()

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

const displayRefresh = computed(() => props.showRefresh !== false)
const displayMultiSelect = computed(() => props.showMultiSelectToggle !== false)
const displayCommandPaletteTrigger = computed(() => props.showCommandPaletteTrigger === true)

function handleOpenPalette() {
  palette?.open()
}
</script>

<template>
  <header class="header-root flex items-center gap-2 text-sm">
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
      <button
        v-if="displayCommandPaletteTrigger"
        class="command-toggle inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition"
        type="button"
        @click="handleOpenPalette"
      >
        <span class="i-carbon-command text-sm" aria-hidden="true" />
        操作
        <span class="shortcut-hint">⌘ K</span>
      </button>
      <SyncIndicator v-if="isLoading" size="sm" />
      <button
        v-if="displayRefresh"
        class="icon-button"
        type="button"
        :disabled="isLoading"
        @click="handleRefresh"
      >
        <span class="i-carbon-renew block" aria-hidden="true" />
      </button>
      <button
        v-if="displayMultiSelect"
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
  flex: 0 0 auto;
}

.header-title p {
  margin: 0;
  color: var(--clipboard-text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.filter-toggle,
.command-toggle,
.multi-select-toggle {
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-subtle);
  color: var(--clipboard-text-secondary);
  white-space: nowrap;
}

.filter-toggle:hover,
.command-toggle:hover,
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

.shortcut-hint {
  margin-left: 4px;
  color: var(--clipboard-text-muted);
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1;
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

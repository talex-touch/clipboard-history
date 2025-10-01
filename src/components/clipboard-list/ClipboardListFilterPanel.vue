<script setup lang="ts">
import type { FilterMenuItem } from '~/composables/useClipboardFilters'

defineProps<{
  items: FilterMenuItem[]
  selected: string
}>()

const emit = defineEmits<{
  (event: 'select', value: FilterMenuItem['value']): void
}>()

function handleSelect(item: FilterMenuItem) {
  emit('select', item.value)
}
</script>

<template>
  <transition name="fade">
    <div v-if="items.length" class="filter-panel" role="menu">
      <button
        v-for="option in items"
        :key="option.value"
        class="filter-option"
        :class="{ active: option.value === selected, muted: !option.count }"
        type="button"
        :disabled="!option.count && option.value !== 'all'"
        @click="handleSelect(option)"
      >
        <span class="option-main">
          <span :class="option.icon" aria-hidden="true" />
          {{ option.label }}
        </span>
        <span class="option-count">{{ option.count }}</span>
      </button>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.filter-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 188px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-elevated);
  box-shadow: var(--clipboard-shadow-strong);
  z-index: 20;
}

.filter-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--clipboard-text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.18s ease;
}

.filter-option:hover {
  background: var(--clipboard-color-accent-softer-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 10%, transparent);
}

.filter-option.active {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 14%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.filter-option.muted {
  color: var(--clipboard-text-disabled);
}

.filter-option:disabled {
  cursor: not-allowed;
  background: transparent;
  border-color: transparent;
  opacity: 0.7;
}

.option-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.option-main span[aria-hidden='true'] {
  font-size: 0.92rem;
}

.option-count {
  font-variant-numeric: tabular-nums;
  color: var(--clipboard-text-muted);
}
</style>

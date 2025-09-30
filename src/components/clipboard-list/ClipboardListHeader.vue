<script setup lang="ts">
defineProps<{
  summaryText: string
  isLoading: boolean
  activeFilterLabel: string
  hasActiveFilter: boolean
}>()

const emit = defineEmits<{
  (event: 'toggleFilter'): void
}>()

function handleToggleFilter() {
  emit('toggleFilter')
}
</script>

<template>
  <header class="list-header">
    <div class="header-title">
      <p>{{ summaryText }}</p>
    </div>
    <div class="header-actions">
      <button
        class="filter-button"
        :class="{ active: hasActiveFilter }"
        type="button"
        @click="handleToggleFilter"
      >
        <span class="i-carbon-filter" aria-hidden="true" />
        {{ activeFilterLabel }}
      </button>
      <div v-if="isLoading" class="list-status">
        <span class="spinner" aria-hidden="true" /> 正在同步…
      </div>
    </div>
  </header>
</template>

<style scoped>
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-title p {
  margin: 0;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.86);
  color: #1e293b;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-button:hover {
  background: #ffffff;
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 10px 18px rgba(79, 70, 229, 0.16);
}

.filter-button.active {
  color: #4338ca;
  border-color: rgba(99, 102, 241, 0.45);
  background: rgba(99, 102, 241, 0.12);
}

.filter-button span[aria-hidden='true'] {
  font-size: 0.92rem;
}

.list-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #64748b;
}

.spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(148, 163, 184, 0.4);
  border-top-color: #6366f1;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

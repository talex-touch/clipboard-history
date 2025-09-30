<script setup lang="ts">
const props = defineProps<{
  isLoading: boolean
  isClearing: boolean
  hasItems: boolean
}>()

const emit = defineEmits<{
  (event: 'refresh'): void
  (event: 'clear'): void
}>()

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
  <div class="list-toolbar">
    <div class="toolbar-veil" aria-hidden="true" />
    <div class="toolbar-content">
      <button
        class="toolbar-button"
        type="button"
        :disabled="isLoading"
        @click="handleRefresh"
      >
        <span class="i-carbon-renew" aria-hidden="true" />
        刷新
      </button>
      <button
        class="toolbar-button danger"
        type="button"
        :disabled="isClearing || !hasItems"
        @click="handleClear"
      >
        <span class="i-carbon-trash-can" aria-hidden="true" />
        清空
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-toolbar {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding-top: 18px;
}

.toolbar-veil {
  position: absolute;
  left: -24px;
  right: -16px;
  bottom: 0;
  height: 120px;
  background: linear-gradient(180deg, rgba(248, 249, 252, 0), rgba(248, 249, 252, 0.96));
  backdrop-filter: blur(14px);
  pointer-events: none;
  border-radius: 0 0 24px 24px;
}

.toolbar-content {
  position: relative;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 16px 12px 6px;
}

.toolbar-button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 0;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(255, 255, 255, 0.86);
  color: #1e293b;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toolbar-button:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 12px 25px rgba(79, 70, 229, 0.16);
}

.toolbar-button.danger {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.35);
}

.toolbar-button.danger:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.55);
  box-shadow: 0 12px 25px rgba(239, 68, 68, 0.18);
}

.toolbar-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar-button span[aria-hidden='true'] {
  font-size: 0.92rem;
}
</style>

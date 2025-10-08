<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}>(), {
  label: '正在同步…',
  size: 'md',
  showIcon: true,
})

const rootClass = computed(() => ({
  [`size-${props.size}`]: true,
}))
</script>

<template>
  <div class="SyncIndicator inline-flex items-center gap-1.5" :class="rootClass">
    <span v-if="showIcon" class="spinner" aria-hidden="true" />
    <span class="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.SyncIndicator {
  color: var(--clipboard-text-muted);
  font-size: 0.9rem;
}

.SyncIndicator .spinner {
  display: inline-block;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
  border: 2px solid color-mix(in srgb, var(--clipboard-text-muted, #94a3b8) 32%, transparent);
  border-top-color: var(--clipboard-color-accent, #6366f1);
}

.SyncIndicator .label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.SyncIndicator.size-sm {
  font-size: 0.8rem;
}

.SyncIndicator.size-sm .spinner {
  width: 0.75rem;
  height: 0.75rem;
  border-width: 2px;
}

.SyncIndicator.size-md .spinner {
  width: 1rem;
  height: 1rem;
  border-width: 2px;
}

.SyncIndicator.size-lg {
  font-size: 1rem;
  gap: 0.75rem;
}

.SyncIndicator.size-lg .spinner {
  width: 1.25rem;
  height: 1.25rem;
  border-width: 3px;
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

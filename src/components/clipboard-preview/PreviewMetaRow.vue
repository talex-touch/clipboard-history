<script setup lang="ts">
/**
 * PreviewMetaRow - Single meta row component
 * @description Displays a single meta item with label on left and value on right
 */
defineProps<{
  /** Label text */
  label: string
  /** Value text */
  value: string
}>()
</script>

<template>
  <div class="flex items-center justify-between border-b border-[var(--clipboard-border-color)] py-2">
    <span class="text-3.3 text-[var(--clipboard-text-muted)]">{{ label }}</span>
    <span class="text-right text-3.3 text-[var(--clipboard-text-primary)]">{{ value }}</span>
  </div>
</template>

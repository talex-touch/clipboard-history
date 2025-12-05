<script setup lang="ts">
/**
 * PreviewEmpty - Empty state component for clipboard preview
 * @description Displays a placeholder when no clipboard item is selected
 */
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center gap-3 text-center text-[var(--clipboard-text-muted)]">
    <div
      class="h-13 w-13 inline-flex items-center justify-center rounded-3.5 bg-[var(--clipboard-surface-ghost)] text-5.5 text-[var(--clipboard-text-muted)]"
      aria-hidden="true"
    >
      <span class="i-carbon-arrow-up-right" aria-hidden="true" />
    </div>
    <p>在左侧选择一个剪贴记录以查看详情</p>
  </div>
</template>

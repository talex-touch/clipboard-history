<script setup lang="ts">
defineProps<{
  isLoading: boolean
}>()
</script>

<template>
  <div v-if="!isLoading" class="list-empty">
    <div class="empty-icon" aria-hidden="true">
      <span class="i-carbon-notebook" aria-hidden="true" />
    </div>
    <p>
      暂无剪贴内容
    </p>
    <p class="empty-hint">
      复制一些文本或图片后会出现在这里
    </p>
  </div>
</template>

<style scoped>
.list-empty {
  margin: 0 auto;
  text-align: center;
  color: var(--clipboard-text-muted);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 32px 0;
}

.empty-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  margin: 0 auto;
  background: var(--clipboard-surface-ghost);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--clipboard-surface-ghost, rgba(148, 163, 184, 0.12)) 60%, transparent),
    color-mix(in srgb, var(--clipboard-surface-ghost, rgba(148, 163, 184, 0.12)) 90%, transparent)
  );
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--clipboard-text-muted);
  font-size: 1.3rem;
}

.empty-hint {
  font-size: 0.78rem;
  color: var(--clipboard-text-disabled);
  margin: 0;
}
</style>

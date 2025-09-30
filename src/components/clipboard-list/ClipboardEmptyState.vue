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
  color: #94a3b8;
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
  background: linear-gradient(145deg, rgba(148, 163, 184, 0.1), rgba(148, 163, 184, 0.2));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 1.3rem;
}

.empty-hint {
  font-size: 0.78rem;
  color: #a1acc5;
  margin: 0;
}
</style>

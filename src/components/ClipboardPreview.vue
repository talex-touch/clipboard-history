<script setup lang="ts">
import type { ClipboardItem } from '~/composables/useClipboard'

defineProps<{
  item: ClipboardItem | null
}>()
</script>

<template>
  <div class="clipboard-preview">
    <div v-if="item">
      <div v-if="item.type === 'text'">
        <pre>{{ item.content }}</pre>
      </div>
      <div v-else-if="item.type === 'image'">
        <img :src="item.content" alt="Image preview">
      </div>
      <div class="timestamp">
        {{ new Date(item.timestamp).toLocaleString() }}
      </div>
    </div>
    <div v-else class="no-item-selected">
      <p>Select an item to preview</p>
    </div>
  </div>
</template>

<style scoped>
.clipboard-preview {
  height: 100%;
}

.no-item-selected {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #888;
}

.timestamp {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: #666;
}
</style>

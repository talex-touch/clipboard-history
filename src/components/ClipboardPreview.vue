<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed } from 'vue'

const props = defineProps<{
  item: PluginClipboardItem | null
}>()

const formattedTimestamp = computed(() => {
  if (!props.item?.timestamp)
    return '未记录时间'

  const date = props.item.timestamp instanceof Date
    ? props.item.timestamp
    : new Date(props.item.timestamp)

  if (Number.isNaN(date.getTime()))
    return '未记录时间'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
})
</script>

<template>
  <div class="clipboard-preview">
    <div v-if="item">
      <div v-if="item.type === 'text'">
        <pre>{{ item.content }}</pre>
      </div>
      <div v-else-if="item.type === 'image'">
        <img :src="item.thumbnail || item.content" alt="Image preview">
      </div>
      <div v-else-if="item.type === 'files'">
        <pre>{{ item.rawContent ?? item.content }}</pre>
      </div>
      <div class="timestamp">
        {{ formattedTimestamp }}
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

.clipboard-preview img {
  max-width: 100%;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.15);
}

.clipboard-preview pre {
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
  color: #1f2937;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
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

<script setup lang="ts">
import type { ClipboardItem } from '~/composables/useClipboard'
import ClipboardPreview from '~/components/ClipboardPreview.vue'
import { useClipboard } from '~/composables/useClipboard'

defineOptions({
  name: 'ClipboardManagerPage',
})

const { clipboardItems } = useClipboard()
const selectedItem = ref<ClipboardItem | null>(null)

function selectItem(item: ClipboardItem) {
  selectedItem.value = item
}
</script>

<template>
  <div class="clipboard-manager-page p-4">
    <div class="clipboard-list p-4">
      <ul>
        <li
          v-for="item in clipboardItems"
          :key="item.id"
          class="clipboard-item"
          :class="{ active: selectedItem?.id === item.id }"
          @click="selectItem(item)"
        >
          <span class="item-content">{{ item.content }}</span>
          <span class="item-type">{{ item.type }}</span>
        </li>
      </ul>
    </div>
    <div class="preview-area">
      <ClipboardPreview :item="selectedItem" />
    </div>
  </div>
</template>

<style scoped>
.clipboard-manager-page {
  display: flex;
  height: 100vh;
}

.clipboard-list {
  width: 300px;
  border-right: 1px solid #ccc;
  overflow-y: auto;
}

.clipboard-item {
  cursor: pointer;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.item-type {
  font-size: 0.8rem;
  color: #888;
}

.preview-area {
  flex: 1;
}
</style>

<route lang="yaml">
meta:
  layout: default
</route>

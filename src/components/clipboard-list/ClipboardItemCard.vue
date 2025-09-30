<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed } from 'vue'
import { getItemKey } from '~/composables/useClipboardManager'

const props = defineProps<{
  item: PluginClipboardItem
  index: number
  isActive: boolean
  formatTimestamp: (timestamp: PluginClipboardItem['timestamp']) => string
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
}>()

const typeIconMap: Record<string, string> = {
  text: 'i-carbon-text-align-left',
  image: 'i-carbon-image',
  html: 'i-carbon-code',
  richtext: 'i-carbon-text-style',
  files: 'i-carbon-document',
  file: 'i-carbon-document',
  url: 'i-carbon-link',
  application: 'i-carbon-application-web',
}

const itemKey = computed(() => getItemKey(props.item))
const iconClass = computed(() => resolveTypeIcon(props.item.type))
const typeLabel = computed(() => resolveTypeLabel(props.item.type))
const timestampText = computed(() => props.formatTimestamp(props.item.timestamp))

function resolveTypeIcon(type?: PluginClipboardItem['type']) {
  if (!type)
    return 'i-carbon-clipboard'
  return typeIconMap[type] ?? 'i-carbon-clipboard'
}

function resolveTypeLabel(type?: PluginClipboardItem['type']) {
  if (!type)
    return '未知类型'
  switch (type) {
    case 'text':
      return '文本'
    case 'image':
      return '图片'
    case 'files':
    case 'file':
      return '文件'
    case 'html':
      return 'HTML'
    case 'richtext':
      return '富文本'
    case 'url':
      return '链接'
    case 'application':
      return '应用数据'
    default:
      return type
  }
}

function handleSelect() {
  emit('select', props.item)
}
</script>

<template>
  <li
    :id="`clipboard-item-${itemKey}`"
    :data-item-id="itemKey"
    class="clipboard-item"
    role="option"
    :aria-selected="isActive"
    :class="{ active: isActive }"
    @click="handleSelect"
  >
    <div class="item-icon" :class="iconClass" aria-hidden="true" />
    <div class="item-main">
      <p class="item-content" :title="item.content || '（无内容）'">
        {{ item.content || '（无内容）' }}
      </p>
      <div class="item-meta">
        <span class="meta-chip" :title="typeLabel">
          <span class="chip-icon" :class="iconClass" aria-hidden="true" />
          {{ typeLabel }}
        </span>
        <span class="meta-chip">
          <span class="chip-icon i-carbon-time" aria-hidden="true" />
          {{ timestampText }}
        </span>
        <span v-if="item.sourceApp" class="meta-chip" :title="item.sourceApp">
          <span class="chip-icon i-carbon-application" aria-hidden="true" />
          {{ item.sourceApp }}
        </span>
        <span v-if="item.isFavorite" class="meta-chip favorite">
          <span class="chip-icon i-carbon-star-filled" aria-hidden="true" />
          收藏
        </span>
      </div>
    </div>
    <div class="item-shortcut" aria-hidden="true">
      <span class="shortcut-key">⌘</span>
      <span class="shortcut-key">{{ index + 1 }}</span>
    </div>
  </li>
</template>

<style scoped>
.clipboard-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.clipboard-item:hover,
.clipboard-item:focus-visible {
  background: #ffffff;
  border-color: rgba(99, 102, 241, 0.28);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.clipboard-item.active {
  background: linear-gradient(160deg, rgba(99, 102, 241, 0.16), rgba(129, 140, 248, 0.28));
  border-color: rgba(99, 102, 241, 0.45);
  box-shadow: 0 20px 42px rgba(79, 70, 229, 0.25);
  color: #1e1b4b;
}

.item-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  font-size: 1.05rem;
}

.clipboard-item.active .item-icon {
  background: rgba(255, 255, 255, 0.75);
  color: #4338ca;
}

.item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-content {
  margin: 0;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clipboard-item.active .item-content {
  color: #1e1b4b;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.72rem;
  color: #64748b;
}

.clipboard-item.active .item-meta {
  color: rgba(30, 27, 75, 0.8);
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  backdrop-filter: blur(3px);
}

.meta-chip .chip-icon {
  font-size: 0.78rem;
}

.meta-chip.favorite {
  background: rgba(249, 215, 76, 0.18);
  color: #b45309;
}

.clipboard-item.active .meta-chip {
  background: rgba(67, 56, 202, 0.12);
  color: rgba(30, 27, 75, 0.85);
}

.clipboard-item.active .meta-chip.favorite {
  background: rgba(253, 230, 138, 0.36);
  color: #854d0e;
}

.item-shortcut {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 600;
}

.clipboard-item.active .item-shortcut {
  color: rgba(30, 27, 75, 0.75);
}

.shortcut-key {
  min-width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.clipboard-item.active .shortcut-key {
  background: rgba(79, 70, 229, 0.16);
}

@media (max-width: 1024px) {
  .clipboard-item {
    grid-template-columns: 36px minmax(0, 1fr) auto;
  }
}
</style>

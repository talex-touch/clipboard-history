<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed, ref } from 'vue'
import { getItemKey } from '~/composables/useClipboardManager'

const props = defineProps<{
  items: PluginClipboardItem[]
  selectedKey: string | null
  total: number
  pageSize: number
  isLoading: boolean
  isLoadingMore: boolean
  isClearing: boolean
  canLoadMore: boolean
  errorMessage: string | null
  formatTimestamp: (timestamp: PluginClipboardItem['timestamp']) => string
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
  (event: 'refresh'): void
  (event: 'clear'): void
  (event: 'loadMore'): void
}>()

const scrollAreaRef = ref<HTMLElement | null>(null)

const summaryText = computed(() => {
  if (!props.total)
    return '暂无记录'
  const pageSizeText = props.pageSize ? `· 每页 ${props.pageSize} 条` : ''
  return `共 ${props.total} 条记录 ${pageSizeText}`
})

const hasItems = computed(() => props.items.length > 0)

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

function handleSelect(item: PluginClipboardItem) {
  emit('select', item)
}

function handleRefresh() {
  emit('refresh')
}

function handleClear() {
  emit('clear')
}

function handleLoadMore() {
  emit('loadMore')
  if (scrollAreaRef.value)
    scrollAreaRef.value.scrollTop = scrollAreaRef.value.scrollHeight
}
</script>

<template>
  <div
    class="clipboard-list"
    role="listbox"
    tabindex="0"
    :aria-activedescendant="selectedKey ? `clipboard-item-${selectedKey}` : undefined"
  >
    <header class="list-header">
      <div class="header-title">
        <span class="title-icon" aria-hidden="true">
          <span class="i-carbon-clipboard" aria-hidden="true" />
        </span>
        <div class="title-text">
          <h2>剪贴板历史</h2>
          <p>{{ summaryText }}</p>
        </div>
      </div>
      <div v-if="isLoading" class="list-status">
        <span class="spinner" aria-hidden="true" /> 正在同步…
      </div>
    </header>

    <div v-if="errorMessage" class="list-error" role="alert">
      <span class="i-carbon-warning" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>

    <div ref="scrollAreaRef" class="list-scroll">
      <ul class="list-body">
        <li
          v-for="(item, index) in items"
          :id="`clipboard-item-${getItemKey(item)}`"
          :key="getItemKey(item)"
          class="clipboard-item"
          :data-item-id="getItemKey(item)"
          :aria-selected="selectedKey === getItemKey(item)"
          :class="{ active: selectedKey === getItemKey(item) }"
          role="option"
          @click="handleSelect(item)"
        >
          <div class="item-icon" :class="resolveTypeIcon(item.type)" aria-hidden="true" />
          <div class="item-main">
            <p class="item-content" :title="item.content || '（无内容）'">
              {{ item.content || '（无内容）' }}
            </p>
            <div class="item-meta">
              <span class="meta-chip" :title="resolveTypeLabel(item.type)">
                <span class="chip-icon" :class="resolveTypeIcon(item.type)" aria-hidden="true" />
                {{ resolveTypeLabel(item.type) }}
              </span>
              <span class="meta-chip">
                <span class="chip-icon i-carbon-time" aria-hidden="true" />
                {{ formatTimestamp(item.timestamp) }}
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
      </ul>

      <button
        v-if="canLoadMore && !isLoading"
        class="ghost-button load-more"
        type="button"
        :disabled="isLoadingMore"
        @click="handleLoadMore"
      >
        <span class="i-carbon-chevron-down" aria-hidden="true" />
        {{ isLoadingMore ? '加载中…' : '加载更多' }}
      </button>

      <div v-if="!hasItems && !isLoading" class="list-empty">
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
    </div>
  </div>
</template>

<style scoped>
.clipboard-list {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 26px 24px 18px;
  gap: 18px;
  box-sizing: border-box;
}

.list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(99, 102, 241, 0.18), rgba(79, 70, 229, 0.28));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.title-icon > span {
  font-size: 1.2rem;
  color: #4f46e5;
}

.title-text h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.title-text p {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: #64748b;
}

.list-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #64748b;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(148, 163, 184, 0.4);
  border-top-color: #6366f1;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.list-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(248, 113, 113, 0.12);
  color: #b91c1c;
  font-size: 0.82rem;
}

.list-scroll {
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-body {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.clipboard-item {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid transparent;
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
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: 0 14px 28px rgba(79, 70, 229, 0.18);
  transform: translateY(-1px);
}

.clipboard-item.active {
  background: linear-gradient(140deg, #4f46e5, #6366f1);
  border-color: transparent;
  box-shadow: 0 18px 32px rgba(79, 70, 229, 0.3);
  color: #ffffff;
}

.item-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  font-size: 1.4rem;
}

.clipboard-item.active .item-icon {
  background: rgba(255, 255, 255, 0.24);
  color: #ffffff;
}

.item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  color: #ffffff;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.75rem;
  color: #64748b;
}

.clipboard-item.active .item-meta {
  color: rgba(255, 255, 255, 0.78);
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  backdrop-filter: blur(4px);
}

.meta-chip .chip-icon {
  font-size: 0.9rem;
}

.meta-chip.favorite {
  background: rgba(249, 215, 76, 0.2);
  color: #b45309;
}

.clipboard-item.active .meta-chip {
  background: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.85);
}

.clipboard-item.active .meta-chip.favorite {
  background: rgba(255, 255, 255, 0.28);
  color: #ffe082;
}

.item-shortcut {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
}

.clipboard-item.active .item-shortcut {
  color: rgba(255, 255, 255, 0.8);
}

.shortcut-key {
  min-width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.18);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.clipboard-item.active .shortcut-key {
  background: rgba(255, 255, 255, 0.22);
}

.ghost-button.load-more {
  align-self: center;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.75);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.18s ease;
}

.ghost-button.load-more:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.18);
}

.ghost-button.load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
  background: linear-gradient(145deg, rgba(148, 163, 184, 0.12), rgba(148, 163, 184, 0.28));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 1.6rem;
}

.empty-hint {
  font-size: 0.78rem;
  color: #a1acc5;
  margin: 0;
}

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
  gap: 12px;
  justify-content: space-between;
  padding: 18px 12px 6px;
}

.toolbar-button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 0;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.82);
  color: #475569;
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
  color: #dc2626;
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

.list-scroll::-webkit-scrollbar {
  width: 6px;
}

.list-scroll::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 1024px) {
  .clipboard-list {
    padding: 22px 18px 14px;
  }

  .clipboard-item {
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }
}
</style>

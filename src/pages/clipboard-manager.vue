<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { useClipboardHistory } from '@talex-touch/utils/plugin/sdk'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ClipboardPreview from '~/components/ClipboardPreview.vue'

defineOptions({
  name: 'ClipboardManagerPage',
})

const clipboard = useClipboardHistory()

const clipboardItems = ref<PluginClipboardItem[]>([])
const selectedItem = ref<PluginClipboardItem | null>(null)
const selectedKey = ref<string | null>(null)
const listPanelRef = ref<HTMLElement | null>(null)

const isLoading = ref(false)
const isLoadingMore = ref(false)
const isClearing = ref(false)
const favoritePending = ref(false)
const deletePending = ref(false)
const errorMessage = ref<string | null>(null)

const page = ref(1)
const total = ref(0)
const pageSize = ref(0)

let stopClipboardListener: (() => void) | null = null

const canLoadMore = computed(() => clipboardItems.value.length < total.value)

const activeIndex = computed(() => {
  if (!selectedKey.value)
    return -1
  return clipboardItems.value.findIndex(item => getItemKey(item) === selectedKey.value)
})

onMounted(async () => {
  await bootstrap()
})

onBeforeUnmount(() => {
  stopClipboardListener?.()
})

async function bootstrap() {
  errorMessage.value = null
  try {
    await loadHistory({ reset: true, showInitialSpinner: true })
    stopClipboardListener = clipboard.onDidChange(handleClipboardChange)
  }
  catch (error) {
    errorMessage.value = formatError(error)
  }
  finally {
    isLoading.value = false
  }
}

async function loadHistory(options: {
  reset?: boolean
  showInitialSpinner?: boolean
} = {}) {
  const { reset = false, showInitialSpinner = false } = options

  if (showInitialSpinner || reset)
    errorMessage.value = null

  if (reset)
    page.value = 1

  const targetPage = reset ? 1 : page.value + 1

  if (!reset && !canLoadMore.value)
    return

  if (showInitialSpinner)
    isLoading.value = true
  else if (!reset)
    isLoadingMore.value = true

  try {
    const payload = await clipboard.getHistory({ page: targetPage })
    const history = payload.history ?? []

    page.value = payload.page
    total.value = payload.total
    pageSize.value = payload.pageSize

    clipboardItems.value = reset
      ? history
      : mergeHistory(clipboardItems.value, history)

    ensureSelection()
  }
  catch (error) {
    errorMessage.value = formatError(error)
  }
  finally {
    if (showInitialSpinner)
      isLoading.value = false
    if (!showInitialSpinner && !reset)
      isLoadingMore.value = false
  }
}

function mergeHistory(existing: PluginClipboardItem[], incoming: PluginClipboardItem[]) {
  const next = [...existing]
  for (const item of incoming) {
    const key = getItemKey(item)
    const index = next.findIndex(existingItem => getItemKey(existingItem) === key)
    if (index === -1)
      next.push(item)
    else
      next.splice(index, 1, { ...next[index], ...item })
  }
  return next
}

function handleClipboardChange(item: PluginClipboardItem) {
  const key = getItemKey(item)
  const index = clipboardItems.value.findIndex(existing => getItemKey(existing) === key)
  if (index === -1) {
    clipboardItems.value.unshift(item)
    total.value += 1
  }
  else {
    clipboardItems.value.splice(index, 1, { ...clipboardItems.value[index], ...item })
  }

  ensureSelection(key)
}

function ensureSelection(preferredKey?: string) {
  if (!clipboardItems.value.length) {
    selectedItem.value = null
    selectedKey.value = null
    return
  }

  const targetKey = preferredKey ?? selectedKey.value
  if (!targetKey) {
    setSelection(clipboardItems.value[0])
    return
  }

  const match = clipboardItems.value.find(item => getItemKey(item) === targetKey)
  if (match)
    setSelection(match)
  else
    setSelection(clipboardItems.value[0])
}

function setSelection(item: PluginClipboardItem) {
  const key = getItemKey(item)
  selectedItem.value = item
  selectedKey.value = key
  nextTick(() => ensureItemVisible(key))
}

function ensureItemVisible(key: string) {
  const container = listPanelRef.value
  if (!container)
    return

  const selector = `[data-item-id="${escapeSelector(key)}"]`
  const target = container.querySelector<HTMLElement>(selector)
  target?.scrollIntoView({ block: 'nearest' })
}

function selectItem(item: PluginClipboardItem) {
  setSelection(item)
}

function selectByIndex(index: number) {
  if (!clipboardItems.value.length)
    return

  const normalizedIndex = (index + clipboardItems.value.length) % clipboardItems.value.length
  const nextItem = clipboardItems.value[normalizedIndex]
  if (nextItem)
    setSelection(nextItem)
}

function handleListKeydown(event: KeyboardEvent) {
  if (!clipboardItems.value.length)
    return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectByIndex((activeIndex.value === -1 ? 0 : activeIndex.value) + 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectByIndex((activeIndex.value === -1 ? clipboardItems.value.length - 1 : activeIndex.value) - 1)
  }
  else if (event.key === 'Home') {
    event.preventDefault()
    selectByIndex(0)
  }
  else if (event.key === 'End') {
    event.preventDefault()
    selectByIndex(clipboardItems.value.length - 1)
  }
}

async function refreshHistory() {
  await loadHistory({ reset: true, showInitialSpinner: true })
}

async function loadMore() {
  await loadHistory({ reset: false })
}

async function toggleFavorite() {
  if (!selectedItem.value?.id || favoritePending.value)
    return

  favoritePending.value = true
  errorMessage.value = null
  const nextState = !selectedItem.value.isFavorite

  try {
    await clipboard.setFavorite({ id: Number(selectedItem.value.id), isFavorite: nextState })

    const key = getItemKey(selectedItem.value)
    const index = clipboardItems.value.findIndex(item => getItemKey(item) === key)
    if (index !== -1) {
      clipboardItems.value.splice(index, 1, { ...clipboardItems.value[index], isFavorite: nextState })
      selectedItem.value = { ...selectedItem.value, isFavorite: nextState }
    }
  }
  catch (error) {
    errorMessage.value = formatError(error)
  }
  finally {
    favoritePending.value = false
  }
}

async function deleteSelected() {
  if (!selectedItem.value?.id || deletePending.value)
    return

  deletePending.value = true
  errorMessage.value = null
  const key = getItemKey(selectedItem.value)

  try {
    await clipboard.deleteItem({ id: Number(selectedItem.value.id) })

    clipboardItems.value = clipboardItems.value.filter(item => getItemKey(item) !== key)
    total.value = Math.max(0, total.value - 1)
    ensureSelection()
  }
  catch (error) {
    errorMessage.value = formatError(error)
  }
  finally {
    deletePending.value = false
  }
}

async function clearHistory() {
  if (isClearing.value)
    return

  isClearing.value = true
  errorMessage.value = null
  try {
    await clipboard.clearHistory()
    clipboardItems.value = []
    total.value = 0
    ensureSelection()
  }
  catch (error) {
    errorMessage.value = formatError(error)
  }
  finally {
    isClearing.value = false
  }
}

function getItemKey(item: PluginClipboardItem) {
  if (item.id !== undefined && item.id !== null)
    return `id-${item.id}`

  if (item.timestamp) {
    const date = item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp)
    if (!Number.isNaN(date.getTime()))
      return `ts-${date.getTime()}`
  }

  const seed = item.content ?? ''
  let hash = 0
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0

  return `content-${hash.toString(16)}`
}

function escapeSelector(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
    return CSS.escape(value)

  return value.replace(/['"\\]/g, '\\$&')
}

function formatTimestamp(timestamp: PluginClipboardItem['timestamp']) {
  if (!timestamp)
    return '未记录时间'

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime()))
    return '未记录时间'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatError(error: unknown) {
  if (error instanceof Error)
    return error.message
  if (typeof error === 'string')
    return error
  try {
    return JSON.stringify(error)
  }
  catch {
    return String(error)
  }
}
</script>

<template>
  <div class="clipboard-manager-page">
    <div class="manager-panel">
      <aside
        ref="listPanelRef"
        class="clipboard-list"
        role="listbox"
        tabindex="0"
        :aria-activedescendant="selectedKey ? `clipboard-item-${selectedKey}` : undefined"
        @keydown="handleListKeydown"
      >
        <header class="list-header">
          <div>
            <h1 class="list-title">
              剪贴板历史记录
            </h1>
            <p class="list-subtitle">
              快速查看与管理最近的剪贴内容
            </p>
          </div>
          <div class="list-actions">
            <button class="ghost-button" type="button" :disabled="isLoading" @click="refreshHistory">
              {{ isLoading ? '加载中…' : '刷新' }}
            </button>
            <button
              class="ghost-button danger"
              type="button"
              :disabled="isClearing || !clipboardItems.length"
              @click="clearHistory"
            >
              清空
            </button>
          </div>
        </header>
        <p v-if="total" class="list-summary">
          共 {{ total }} 条记录 · 每页 {{ pageSize }} 条
        </p>
        <div v-if="errorMessage" class="list-error">
          {{ errorMessage }}
        </div>

        <div v-if="isLoading" class="list-status">
          <span class="spinner" aria-hidden="true" /> 正在获取历史…
        </div>

        <ul v-else class="list-body">
          <li
            v-for="(item, index) in clipboardItems"
            :id="`clipboard-item-${getItemKey(item)}`"
            :key="getItemKey(item)"
            class="clipboard-item"
            :data-item-id="getItemKey(item)"
            :aria-selected="selectedKey === getItemKey(item)"
            role="option"
            :class="{ active: selectedKey === getItemKey(item) }"
            @click="selectItem(item)"
          >
            <div class="item-main">
              <span class="item-content" :title="item.content">{{ item.content }}</span>
              <div class="item-meta">
                <span class="item-type">{{ item.type }}</span>
                <span v-if="item.isFavorite" class="item-favorite">已收藏</span>
                <span class="item-time">{{ formatTimestamp(item.timestamp) }}</span>
              </div>
            </div>
            <span class="item-shortcut">Cmd {{ index + 1 }}</span>
          </li>
        </ul>
        <div v-if="!clipboardItems.length && !isLoading" class="list-empty">
          暂无剪贴内容
        </div>

        <button
          v-if="canLoadMore && !isLoading"
          class="ghost-button load-more"
          type="button"
          :disabled="isLoadingMore"
          @click="loadMore"
        >
          {{ isLoadingMore ? '加载中…' : '加载更多' }}
        </button>
      </aside>

      <section class="preview-area">
        <header class="preview-header">
          <div class="preview-title-block">
            <h2 class="preview-title">
              {{ selectedItem ? '预览' : '选择一个项目预览' }}
            </h2>
            <p v-if="selectedItem" class="preview-caption">
              {{ formatTimestamp(selectedItem.timestamp) }}
            </p>
          </div>
          <div class="preview-header-actions">
            <span v-if="selectedItem" class="preview-type">{{ selectedItem.type }}</span>
            <div v-if="selectedItem" class="preview-actions">
              <button
                class="action-button"
                type="button"
                :disabled="favoritePending || !selectedItem?.id"
                @click="toggleFavorite"
              >
                {{ favoritePending ? '更新中…' : selectedItem.isFavorite ? '取消收藏' : '设为收藏' }}
              </button>
              <button
                class="action-button danger"
                type="button"
                :disabled="deletePending || !selectedItem?.id"
                @click="deleteSelected"
              >
                {{ deletePending ? '删除中…' : '删除' }}
              </button>
            </div>
          </div>
        </header>

        <div class="preview-surface">
          <ClipboardPreview :item="selectedItem" />
        </div>

        <dl v-if="selectedItem" class="preview-info">
          <div class="info-row">
            <dt>类型</dt>
            <dd>{{ selectedItem.type }}</dd>
          </div>
          <div class="info-row">
            <dt>记录时间</dt>
            <dd>{{ formatTimestamp(selectedItem.timestamp) }}</dd>
          </div>
          <div v-if="selectedItem.isFavorite" class="info-row">
            <dt>收藏</dt>
            <dd>已收藏</dd>
          </div>
          <div v-if="selectedItem.sourceApp" class="info-row">
            <dt>来源应用</dt>
            <dd>{{ selectedItem.sourceApp }}</dd>
          </div>
          <div class="info-row">
            <dt>标识符</dt>
            <dd>{{ selectedItem.id ?? '未提供' }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>

<style scoped>
.clipboard-manager-page {
  min-height: 100vh;
  margin: 0;
  padding: 36px;
  background: linear-gradient(145deg, #f5f6fb, #eef1f8);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.manager-panel {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  width: min(1120px, 100%);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 28px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 32px 60px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(18px);
}

.clipboard-list {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f8f9fb 0%, #eef1f6 100%);
  padding: 28px 24px;
  gap: 18px;
  border-right: 1px solid rgba(148, 163, 184, 0.2);
  min-height: 460px;
}

.list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.list-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.list-summary {
  margin: 0;
  font-size: 0.8rem;
  color: #94a3b8;
}

.ghost-button {
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.65);
  color: #475569;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ghost-button:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(79, 70, 229, 0.4);
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.18);
  transform: translateY(-1px);
}

.ghost-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost-button.danger:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.45);
  box-shadow: 0 8px 18px rgba(239, 68, 68, 0.16);
}

.list-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 0.85rem;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(148, 163, 184, 0.4);
  border-top-color: #6366f1;
  animation: spin 0.8s linear infinite;
}

.list-error {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(248, 113, 113, 0.1);
  color: #b91c1c;
  font-size: 0.8rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.list-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.list-subtitle {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 0.85rem;
}

.list-body {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 4px;
}

.list-empty {
  margin-top: auto;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
}

.clipboard-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease;
  outline: none;
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
  transform: translateY(-2px);
  color: #ffffff;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-content {
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: #697a94;
}

.item-type {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.item-favorite {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(234, 179, 8, 0.18);
  color: #b45309;
  font-weight: 600;
}

.item-time {
  color: #94a3b8;
}

.item-shortcut {
  font-size: 0.75rem;
  color: #a1acc5;
  font-weight: 500;
}

.clipboard-item.active .item-content {
  color: #ffffff;
}

.clipboard-item.active .item-meta {
  color: rgba(255, 255, 255, 0.82);
}

.clipboard-item.active .item-time {
  color: rgba(255, 255, 255, 0.78);
}

.clipboard-item.active .item-favorite {
  background: rgba(255, 255, 255, 0.22);
  color: #ffe082;
}

.clipboard-item.active .item-shortcut {
  color: rgba(255, 255, 255, 0.82);
}

.clipboard-item.active .item-type {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.preview-area {
  display: flex;
  flex-direction: column;
  padding: 34px 36px;
  background: rgba(255, 255, 255, 0.92);
  min-height: 460px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.preview-header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.preview-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f2937;
}

.preview-caption {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
}

.preview-type {
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.12);
  color: #4f46e5;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-button {
  appearance: none;
  border: 1px solid rgba(79, 70, 229, 0.4);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(129, 140, 248, 0.25));
  color: #312e81;
  border-radius: 12px;
  padding: 6px 18px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.action-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(129, 140, 248, 0.4));
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button.danger {
  border-color: rgba(239, 68, 68, 0.4);
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.16), rgba(239, 68, 68, 0.22));
  color: #7f1d1d;
}

.action-button.danger:hover:not(:disabled) {
  box-shadow: 0 10px 20px rgba(239, 68, 68, 0.22);
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.22), rgba(239, 68, 68, 0.3));
}

.ghost-button.load-more {
  width: 100%;
  margin-top: auto;
  justify-content: center;
  align-self: stretch;
}

.preview-surface {
  flex: 1;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: linear-gradient(180deg, rgba(248, 249, 252, 0.95), rgba(245, 247, 252, 0.9));
  padding: 22px;
  overflow: auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.preview-info {
  margin-top: 24px;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-row dt {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
}

.info-row dd {
  margin: 0;
  font-size: 0.95rem;
  color: #1f2937;
}

.preview-area :deep(.clipboard-preview) {
  height: 100%;
}

.list-body::-webkit-scrollbar,
.preview-surface::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.list-body::-webkit-scrollbar-thumb,
.preview-surface::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.list-body::-webkit-scrollbar-track,
.preview-surface::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 1024px) {
  .clipboard-manager-page {
    padding: 24px;
  }

  .manager-panel {
    grid-template-columns: 280px minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .clipboard-manager-page {
    padding: 20px;
  }

  .manager-panel {
    grid-template-columns: 1fr;
    border-radius: 24px;
  }

  .clipboard-list {
    border-right: none;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 24px 24px 0 0;
  }

  .preview-area {
    border-radius: 0 0 24px 24px;
  }

  .list-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .list-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .preview-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .preview-header-actions {
    align-self: stretch;
  }

  .preview-actions {
    margin-top: 12px;
  }
}
</style>

<route lang="yaml">
meta:
  layout: default
</route>

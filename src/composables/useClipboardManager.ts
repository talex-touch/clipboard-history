import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { useClipboardHistory } from '@talex-touch/utils/plugin/sdk'
import structuredClonePolyfill from '@ungap/structured-clone'
import { useEventListener } from '@vueuse/core'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRaw,
  watch,
} from 'vue'
import { toast } from 'vue-sonner'
import { ensureTFileUrl } from '~/utils/tfile'

type ClipboardHistoryClient = ReturnType<typeof useClipboardHistory> & {
  applyToActiveApp?: (options: { item?: PluginClipboardItem }) => Promise<boolean>
}

function createClipboardHistoryStub(): ClipboardHistoryClient {
  const asyncNoop = async () => {}
  const dispose = () => {}

  return {
    async getHistory() {
      return {
        history: [],
        page: 1,
        pageSize: 0,
        total: 0,
      }
    },
    async setFavorite() {
      await asyncNoop()
    },
    async deleteItem() {
      await asyncNoop()
    },
    async clearHistory() {
      await asyncNoop()
    },
    onDidChange() {
      return dispose
    },
  } as ClipboardHistoryClient
}

interface LoadHistoryOptions {
  reset?: boolean
  showInitialSpinner?: boolean
  ensureSelectionVisible?: boolean
}

function getItemKey(item: PluginClipboardItem) {
  if (item.id !== undefined && item.id !== null)
    return `id-${item.id}`

  if (item.timestamp) {
    const date
      = item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp)
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

export function useClipboardManager() {
  const clipboard: ClipboardHistoryClient = import.meta.env.SSR
    ? createClipboardHistoryStub()
    : (useClipboardHistory() as ClipboardHistoryClient)

  const clipboardItems = ref<PluginClipboardItem[]>([])
  const selectedItem = ref<PluginClipboardItem | null>(null)
  const selectedKey = ref<string | null>(null)
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const isClearing = ref(false)
  const favoritePending = ref(false)
  const deletePending = ref(false)
  const applyPending = ref(false)
  const copyPending = ref(false)
  const bulkDeletePending = ref(false)
  const bulkFavoritePending = ref(false)
  const errorMessage = ref<string | null>(null)

  if (!import.meta.env.SSR) {
    watch(errorMessage, (message) => {
      if (!message)
        return
      toast.error(message)
    })
  }

  const page = ref(1)
  const total = ref(0)
  const pageSize = ref(0)
  const hasReachedHistoryEnd = ref(false)

  const multiSelectMode = ref(false)
  const multiSelectedKeys = ref<string[]>([])

  let stopClipboardListener: (() => void) | null = null
  let stopHotkeys: (() => void) | undefined

  const canLoadMore = computed(() => !hasReachedHistoryEnd.value && clipboardItems.value.length < total.value)
  const multiSelectedKeySet = computed(() => new Set(multiSelectedKeys.value))
  const multiSelectedCount = computed(() => multiSelectedKeys.value.length)
  const multiSelectedItems = computed(() => {
    if (!multiSelectedKeys.value.length)
      return []
    const keySet = multiSelectedKeySet.value
    return clipboardItems.value.filter(item => keySet.has(getItemKey(item)))
  })

  const activeIndex = computed(() => {
    if (!selectedKey.value)
      return -1
    return clipboardItems.value.findIndex(item => getItemKey(item) === selectedKey.value)
  })

  function resolvePluginChannel() {
    if (typeof window === 'undefined')
      return null
    const channel = (window as any)?.$channel
    if (channel && typeof channel.send === 'function')
      return channel
    return null
  }

  function cloneClipboardItem(item: PluginClipboardItem): PluginClipboardItem {
    const rawItem = toRaw(item)
    return structuredClonePolyfill(rawItem)
  }

  async function hideCoreBoxWindow() {
    try {
      const channel = resolvePluginChannel()
      if (!channel)
        return
      await channel.send('hide')
    }
    catch (error) {
      console.error('[ClipboardManager] Failed to hide CoreBox', error)
    }
  }

  async function resolveImageBlob(item: PluginClipboardItem): Promise<Blob> {
    const content = (item.content ?? '').trim()
    if (!content)
      throw new Error('无法解析图片内容')

    const source = content.startsWith('data:') ? content : ensureTFileUrl(content)
    const response = await fetch(source)
    if (!response.ok)
      throw new Error(`无法读取图片数据（${response.status}）`)
    return await response.blob()
  }

  function clearMultiSelection() {
    if (multiSelectedKeys.value.length)
      multiSelectedKeys.value = []
  }

  function setMultiSelectMode(enabled: boolean) {
    if (multiSelectMode.value === enabled)
      return
    multiSelectMode.value = enabled
    if (!enabled)
      clearMultiSelection()
  }

  function toggleMultiSelectMode() {
    setMultiSelectMode(!multiSelectMode.value)
  }

  function toggleMultiSelectItem(item: PluginClipboardItem) {
    const key = getItemKey(item)
    const next = new Set(multiSelectedKeys.value)
    if (next.has(key))
      next.delete(key)
    else
      next.add(key)
    multiSelectedKeys.value = Array.from(next)
  }

  watch(clipboardItems, () => {
    if (!multiSelectedKeys.value.length)
      return
    const existingKeys = new Set(clipboardItems.value.map(entry => getItemKey(entry)))
    const filtered = multiSelectedKeys.value.filter(key => existingKeys.has(key))
    if (filtered.length !== multiSelectedKeys.value.length)
      multiSelectedKeys.value = filtered
  })

  function parseFileListFromItem(item: PluginClipboardItem): string[] {
    if (!item.content)
      return []
    try {
      const parsed = JSON.parse(item.content)
      if (Array.isArray(parsed))
        return parsed.map(entry => String(entry)).filter(Boolean)
    }
    catch {
      // ignore
    }
    return item.content.split(/\r?\n|;+/).map(entry => entry.trim()).filter(Boolean)
  }

  async function writeClipboardFromItem(item: PluginClipboardItem): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard)
      throw new Error('当前环境暂不支持直接写入系统剪贴板')

    if (item.type === 'image') {
      if (typeof ClipboardItem === 'undefined')
        throw new Error('当前浏览器不支持写入图片到剪贴板')

      const blob = await resolveImageBlob(item)
      const clipboardItem = new ClipboardItem({ [blob.type || 'image/png']: blob })
      await navigator.clipboard.write([clipboardItem])
      return
    }

    if (item.type === 'text') {
      if (item.rawContent && typeof item.rawContent === 'string' && typeof ClipboardItem !== 'undefined') {
        const textBlob = new Blob([item.content ?? ''], { type: 'text/plain' })
        const htmlBlob = new Blob([item.rawContent], { type: 'text/html' })
        const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
        await navigator.clipboard.write([clipboardItem])
        return
      }
      await navigator.clipboard.writeText(item.content ?? '')
      return
    }

    if (item.type === 'files') {
      const files = parseFileListFromItem(item)
      if (files.length) {
        await navigator.clipboard.writeText(files.join('\n'))
        return
      }
    }

    await navigator.clipboard.writeText(item.content ?? '')
  }

  function ensureItemVisible(key: string) {
    if (typeof document === 'undefined')
      return

    const selector = `[data-item-id="${escapeSelector(key)}"]`
    const target = document.querySelector<HTMLElement>(selector)
    target?.scrollIntoView({ block: 'nearest' })
  }

  function setSelection(item: PluginClipboardItem) {
    const key = getItemKey(item)
    selectedItem.value = item
    selectedKey.value = key
    nextTick(() => ensureItemVisible(key))
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

  function selectByIndex(index: number) {
    if (!clipboardItems.value.length)
      return

    const normalizedIndex = (index + clipboardItems.value.length) % clipboardItems.value.length
    const nextItem = clipboardItems.value[normalizedIndex]
    if (nextItem)
      setSelection(nextItem)
  }

  function handleArrowNavigation(event: KeyboardEvent) {
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

  function handleQuickSelect(event: KeyboardEvent) {
    if (!clipboardItems.value.length)
      return

    if (!(event.metaKey || event.ctrlKey) || event.shiftKey)
      return

    const key = Number.parseInt(event.key, 10)
    if (Number.isNaN(key) || key <= 0)
      return

    const index = key - 1
    if (index < clipboardItems.value.length)
      selectByIndex(index)
  }

  async function handleHotkeys(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable)
      return

    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.metaKey || event.ctrlKey) {
        const applied = await applyItem()
        if (applied)
          await hideCoreBoxWindow()
      }
      else {
        const copied = await copyItem()
        if (copied)
          await hideCoreBoxWindow()
      }
      return
    }

    handleArrowNavigation(event)
    handleQuickSelect(event)
  }

  async function loadHistory(options: LoadHistoryOptions = {}) {
    const {
      reset = false,
      showInitialSpinner = false,
      ensureSelectionVisible = true,
    } = options

    if (showInitialSpinner || reset)
      errorMessage.value = null

    if (reset) {
      page.value = 1
      hasReachedHistoryEnd.value = false
    }

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
      const previousLength = reset ? 0 : clipboardItems.value.length
      const resolvedPage = typeof payload.page === 'number' ? payload.page : targetPage
      const resolvedPageSize = typeof payload.pageSize === 'number' ? payload.pageSize : pageSize.value

      page.value = resolvedPage
      total.value = payload.total
      pageSize.value = resolvedPageSize

      clipboardItems.value = reset ? history : mergeHistory(clipboardItems.value, history)
      const nextLength = clipboardItems.value.length

      if (reset) {
        const hasMore
          = resolvedPageSize > 0
            ? history.length >= resolvedPageSize
            : history.length > 0
        hasReachedHistoryEnd.value = !hasMore
      }
      else {
        const reachedEnd
          = history.length === 0
            || resolvedPage < targetPage
            || (resolvedPageSize > 0 && history.length < resolvedPageSize)
            || nextLength === previousLength

        hasReachedHistoryEnd.value = !!reachedEnd
      }

      if (ensureSelectionVisible)
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

  async function refreshHistory() {
    await loadHistory({ reset: true, showInitialSpinner: true })
  }

  async function loadMore() {
    await loadHistory({ reset: false, ensureSelectionVisible: false })
  }

  async function applyItem(item: PluginClipboardItem | null = selectedItem.value): Promise<boolean> {
    if (!item || applyPending.value)
      return false

    applyPending.value = true
    errorMessage.value = null

    try {
      const payload = cloneClipboardItem(item)

      if (typeof clipboard.applyToActiveApp === 'function') {
        const success = await clipboard.applyToActiveApp({
          item: payload,
          hideCoreBox: true,
        })
        if (!success)
          throw new Error('自动粘贴失败')
        return true
      }

      const channel = resolvePluginChannel()
      if (!channel)
        throw new Error('无法调用自动粘贴通道')

      const response = await channel.send('clipboard:apply-to-active-app', {
        item: payload,
        hideCoreBox: true,
      })
      if (response && typeof response === 'object' && 'success' in response && !response.success)
        throw new Error((response as { message?: string }).message ?? '自动粘贴失败')

      return true
    }
    catch (error) {
      console.error('[ClipboardManager] Failed to auto apply clipboard item', {
        item,
        error,
      })
      errorMessage.value = formatError(error)
      return false
    }
    finally {
      applyPending.value = false
    }
  }

  async function copyItem(item: PluginClipboardItem | null = selectedItem.value): Promise<boolean> {
    if (!item || copyPending.value)
      return false

    copyPending.value = true
    errorMessage.value = null

    try {
      const payload = cloneClipboardItem(item)
      await writeClipboardFromItem(payload)
      return true
    }
    catch (error) {
      console.error('[ClipboardManager] Failed to copy clipboard item', {
        item,
        error,
      })
      errorMessage.value = formatError(error)
      return false
    }
    finally {
      copyPending.value = false
    }
  }

  async function toggleFavorite() {
    if (!selectedItem.value?.id || favoritePending.value)
      return

    favoritePending.value = true
    errorMessage.value = null
    const nextState = !selectedItem.value.isFavorite

    try {
      await clipboard.setFavorite({
        id: Number(selectedItem.value.id),
        isFavorite: nextState,
      })

      const key = getItemKey(selectedItem.value)
      const index = clipboardItems.value.findIndex(item => getItemKey(item) === key)
      if (index !== -1) {
        clipboardItems.value.splice(index, 1, {
          ...clipboardItems.value[index],
          isFavorite: nextState,
        })
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

  function selectItem(item: PluginClipboardItem) {
    setSelection(item)
  }

  async function bulkDeleteSelected() {
    if (!multiSelectedKeys.value.length || bulkDeletePending.value)
      return

    bulkDeletePending.value = true
    errorMessage.value = null

    const targetKeys = new Set(multiSelectedKeys.value)
    const itemsToDelete = clipboardItems.value.filter(item => targetKeys.has(getItemKey(item)) && item.id != null)

    try {
      for (const item of itemsToDelete)
        await clipboard.deleteItem({ id: Number(item.id) })

      clipboardItems.value = clipboardItems.value.filter(item => !targetKeys.has(getItemKey(item)))
      const deletedCount = itemsToDelete.length
      if (deletedCount)
        total.value = Math.max(0, total.value - deletedCount)

      multiSelectedKeys.value = []
      if (selectedKey.value && targetKeys.has(selectedKey.value))
        ensureSelection()
      else
        ensureSelection(selectedKey.value ?? undefined)
    }
    catch (error) {
      errorMessage.value = formatError(error)
    }
    finally {
      bulkDeletePending.value = false
    }
  }

  async function bulkFavoriteSelected() {
    if (!multiSelectedKeys.value.length || bulkFavoritePending.value)
      return

    bulkFavoritePending.value = true
    errorMessage.value = null

    const targetKeys = new Set(multiSelectedKeys.value)
    const itemsToFavorite = clipboardItems.value.filter(item => targetKeys.has(getItemKey(item)) && item.id != null)

    try {
      for (const item of itemsToFavorite)
        await clipboard.setFavorite({ id: Number(item.id), isFavorite: true })

      clipboardItems.value = clipboardItems.value.map((item) => {
        if (!targetKeys.has(getItemKey(item)))
          return item
        return {
          ...item,
          isFavorite: true,
        }
      })

      if (selectedItem.value && targetKeys.has(getItemKey(selectedItem.value)))
        selectedItem.value = { ...selectedItem.value, isFavorite: true }
    }
    catch (error) {
      errorMessage.value = formatError(error)
    }
    finally {
      bulkFavoritePending.value = false
    }
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

    hasReachedHistoryEnd.value = false
    ensureSelection(key)
  }

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

  onMounted(async () => {
    await bootstrap()
    if (typeof document !== 'undefined')
      stopHotkeys = useEventListener(() => document.body, 'keydown', handleHotkeys)
  })

  onBeforeUnmount(() => {
    stopClipboardListener?.()
    stopHotkeys?.()
  })

  return {
    // state
    clipboardItems,
    selectedItem,
    selectedKey,
    isLoading,
    isLoadingMore,
    isClearing,
    favoritePending,
    deletePending,
    applyPending,
    copyPending,
    bulkDeletePending,
    bulkFavoritePending,
    errorMessage,
    page,
    total,
    pageSize,
    canLoadMore,
    multiSelectMode,
    multiSelectedKeys,
    multiSelectedCount,
    multiSelectedItems,
    // getters
    activeIndex,
    // actions
    selectItem,
    selectByIndex,
    refreshHistory,
    loadMore,
    toggleFavorite,
    deleteSelected,
    clearHistory,
    toggleMultiSelectMode,
    toggleMultiSelectItem,
    clearMultiSelection,
    bulkDeleteSelected,
    bulkFavoriteSelected,
    applyItem,
    copyItem,
    formatTimestamp,
    loadHistory,
    getItemKey,
  }
}

export { formatTimestamp, getItemKey }

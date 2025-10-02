import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { useClipboardHistory } from '@talex-touch/utils/plugin/sdk'
import { useEventListener } from '@vueuse/core'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'

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
  const clipboard = useClipboardHistory()

  const clipboardItems = ref<PluginClipboardItem[]>([])
  const selectedItem = ref<PluginClipboardItem | null>(null)
  const selectedKey = ref<string | null>(null)
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
  let stopHotkeys: (() => void) | undefined

  const canLoadMore = computed(() => clipboardItems.value.length < total.value)

  const activeIndex = computed(() => {
    if (!selectedKey.value)
      return -1
    return clipboardItems.value.findIndex(item => getItemKey(item) === selectedKey.value)
  })

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

  function handleHotkeys(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable)
      return

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

      clipboardItems.value = reset ? history : mergeHistory(clipboardItems.value, history)

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
    errorMessage,
    page,
    total,
    pageSize,
    canLoadMore,
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
    formatTimestamp,
    loadHistory,
    getItemKey,
  }
}

export { formatTimestamp, getItemKey }

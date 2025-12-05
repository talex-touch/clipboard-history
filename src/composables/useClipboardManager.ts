import type { PluginClipboardItem } from '@talex-touch/utils'
import { onCoreBoxInputChange, useBox } from '@talex-touch/utils'
import { useClipboardHistory } from '@talex-touch/utils/plugin/sdk'
import structuredClonePolyfill from '@ungap/structured-clone'
import { useEventListener } from '@vueuse/core'
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  toRaw,
  watch,
  watchEffect,
} from 'vue'
import { toast } from 'vue-sonner'
import { ensureTFileUrl } from '~/utils/tfile'
import { formatTimestamp, getItemKey } from './clipboardUtils'

type ClipboardHistoryClient = ReturnType<typeof useClipboardHistory> & {
  applyToActiveApp?: (options: { item?: PluginClipboardItem }) => Promise<boolean>
}

interface LoadHistoryOptions {
  reset?: boolean
  showInitialSpinner?: boolean
  ensureSelectionVisible?: boolean
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

export function useClipboardManager() {
  const clipboard: ClipboardHistoryClient = import.meta.env.SSR
    ? {} as ClipboardHistoryClient
    : (useClipboardHistory() as ClipboardHistoryClient)
  const box = useBox()

  const state = reactive({
    clipboardItems: [] as PluginClipboardItem[],
    selectedItem: null as PluginClipboardItem | null,
    selectedKey: null as string | null,
    isLoading: false,
    isLoadingMore: false,
    isClearing: false,
    favoritePending: false,
    deletePending: false,
    applyPending: false,
    copyPending: false,
    bulkDeletePending: false,
    bulkFavoritePending: false,
    errorMessage: null as string | null,
    page: 1,
    total: 0,
    pageSize: 0,
    hasReachedHistoryEnd: false,
    multiSelectMode: false,
    multiSelectedKeys: [] as string[],
    multiSelectedCount: 0,
    multiSelectedItems: [] as PluginClipboardItem[],
    canLoadMore: false,
    activeIndex: -1,
  })

  if (!import.meta.env.SSR) {
    watch(() => state.errorMessage, (message) => {
      if (!message)
        return
      toast.error(message)
    })
  }

  let stopClipboardListener: (() => void) | null = null
  let stopHotkeys: (() => void) | undefined

  watchEffect(() => {
    state.canLoadMore = !state.hasReachedHistoryEnd && state.clipboardItems.length < state.total
  })

  watchEffect(() => {
    const keySet = new Set(state.multiSelectedKeys)
    state.multiSelectedCount = state.multiSelectedKeys.length
    state.multiSelectedItems = keySet.size
      ? state.clipboardItems.filter((item: any) => keySet.has(getItemKey(item)))
      : []
  })

  watchEffect(() => {
    state.activeIndex = state.selectedKey
      ? state.clipboardItems.findIndex((item: any) => getItemKey(item) === state.selectedKey)
      : -1
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
    if (state.multiSelectedKeys.length)
      state.multiSelectedKeys = []
  }

  function setMultiSelectMode(enabled: boolean) {
    if (state.multiSelectMode === enabled)
      return
    state.multiSelectMode = enabled
    if (!enabled)
      clearMultiSelection()
  }

  function toggleMultiSelectMode() {
    setMultiSelectMode(!state.multiSelectMode)
  }

  function toggleMultiSelectItem(item: PluginClipboardItem) {
    const key = getItemKey(item)
    const next = new Set(state.multiSelectedKeys)
    if (next.has(key))
      next.delete(key)
    else
      next.add(key)
    state.multiSelectedKeys = Array.from(next)
  }

  watchEffect(() => {
    if (!state.multiSelectedKeys.length)
      return
    const existingKeys = new Set(state.clipboardItems.map((entry: any) => getItemKey(entry)))
    const filtered = state.multiSelectedKeys.filter(key => existingKeys.has(key))
    if (filtered.length !== state.multiSelectedKeys.length)
      state.multiSelectedKeys = filtered
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
    return item.content.split(/\r?\n|;+/).map((entry: any) => entry.trim()).filter(Boolean)
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
    state.selectedItem = item
    state.selectedKey = key
    nextTick(() => ensureItemVisible(key))
  }

  function ensureSelection(preferredKey?: string) {
    if (!state.clipboardItems.length) {
      state.selectedItem = null
      state.selectedKey = null
      return
    }

    const targetKey = preferredKey ?? state.selectedKey
    if (!targetKey) {
      setSelection(state.clipboardItems[0])
      return
    }

    const match = state.clipboardItems.find((item: any) => getItemKey(item) === targetKey)
    if (match)
      setSelection(match)
    else
      setSelection(state.clipboardItems[0])
  }

  function selectByIndex(index: number) {
    if (!state.clipboardItems.length)
      return

    const normalizedIndex = (index + state.clipboardItems.length) % state.clipboardItems.length
    const nextItem = state.clipboardItems[normalizedIndex]
    if (nextItem)
      setSelection(nextItem)
  }

  function handleArrowNavigation(event: KeyboardEvent) {
    if (!state.clipboardItems.length)
      return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectByIndex((state.activeIndex === -1 ? 0 : state.activeIndex) + 1)
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectByIndex((state.activeIndex === -1 ? state.clipboardItems.length - 1 : state.activeIndex) - 1)
    }
    else if (event.key === 'Home') {
      event.preventDefault()
      selectByIndex(0)
    }
    else if (event.key === 'End') {
      event.preventDefault()
      selectByIndex(state.clipboardItems.length - 1)
    }
  }

  function handleQuickSelect(event: KeyboardEvent) {
    if (!state.clipboardItems.length)
      return

    if (!(event.metaKey || event.ctrlKey) || event.shiftKey)
      return

    const key = Number.parseInt(event.key, 10)
    if (Number.isNaN(key) || key <= 0)
      return

    const index = key - 1
    if (index < state.clipboardItems.length)
      selectByIndex(index)
  }

  async function handleHotkeys(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable)
      return

    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && (event.key === 's' || event.key === 'S')) {
      event.preventDefault()
      await toggleFavorite()
      return
    }

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
      state.errorMessage = null

    if (reset) {
      state.page = 1
      state.hasReachedHistoryEnd = false
    }

    const targetPage = reset ? 1 : state.page + 1

    if (!reset && !state.canLoadMore)
      return

    if (showInitialSpinner)
      state.isLoading = true
    else if (!reset)
      state.isLoadingMore = true

    try {
      const input = await box.getInput()
      const payload = await clipboard.getHistory({ page: targetPage, keyword: input })
      const history = payload.history ?? []
      const previousLength = reset ? 0 : state.clipboardItems.length
      const resolvedPage = typeof payload.page === 'number' ? payload.page : targetPage
      const resolvedPageSize = typeof payload.pageSize === 'number' ? payload.pageSize : state.pageSize

      state.page = resolvedPage
      state.total = payload.total
      state.pageSize = resolvedPageSize

      state.clipboardItems = reset ? history : mergeHistory(state.clipboardItems, history)
      const nextLength = state.clipboardItems.length

      if (reset) {
        const hasMore
          = resolvedPageSize > 0
            ? history.length >= resolvedPageSize
            : history.length > 0
        state.hasReachedHistoryEnd = !hasMore
      }
      else {
        const reachedEnd
          = history.length === 0
            || resolvedPage < targetPage
            || (resolvedPageSize > 0 && history.length < resolvedPageSize)
            || nextLength === previousLength

        state.hasReachedHistoryEnd = !!reachedEnd
      }

      if (ensureSelectionVisible)
        ensureSelection()
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      if (showInitialSpinner)
        state.isLoading = false
      if (!showInitialSpinner && !reset)
        state.isLoadingMore = false
    }
  }

  async function refreshHistory() {
    await loadHistory({ reset: true, showInitialSpinner: true })
  }

  async function loadMore() {
    await loadHistory({ reset: false, ensureSelectionVisible: false })
  }

  async function applyItem(item: PluginClipboardItem | null = state.selectedItem): Promise<boolean> {
    if (!item || state.applyPending)
      return false

    state.applyPending = true
    state.errorMessage = null

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
      state.errorMessage = formatError(error)
      return false
    }
    finally {
      state.applyPending = false
    }
  }

  async function copyItem(item: PluginClipboardItem | null = state.selectedItem): Promise<boolean> {
    if (!item || state.copyPending)
      return false

    state.copyPending = true
    state.errorMessage = null

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
      state.errorMessage = formatError(error)
      return false
    }
    finally {
      state.copyPending = false
    }
  }

  async function toggleFavorite() {
    if (!state.selectedItem?.id || state.favoritePending)
      return

    state.favoritePending = true
    state.errorMessage = null
    const nextState = !state.selectedItem.isFavorite

    try {
      await clipboard.setFavorite({
        id: Number(state.selectedItem.id),
        isFavorite: nextState,
      })

      const key = getItemKey(state.selectedItem)
      const index = state.clipboardItems.findIndex((item: any) => getItemKey(item) === key)
      if (index !== -1) {
        state.clipboardItems.splice(index, 1, {
          ...state.clipboardItems[index],
          isFavorite: nextState,
        })
        state.selectedItem = { ...state.selectedItem, isFavorite: nextState }
      }
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      state.favoritePending = false
    }
  }

  async function deleteSelected() {
    if (!state.selectedItem?.id || state.deletePending)
      return

    state.deletePending = true
    state.errorMessage = null
    const key = getItemKey(state.selectedItem)

    try {
      await clipboard.deleteItem({ id: Number(state.selectedItem.id) })

      state.clipboardItems = state.clipboardItems.filter((item: any) => getItemKey(item) !== key)
      state.total = Math.max(0, state.total - 1)
      ensureSelection()
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      state.deletePending = false
    }
  }

  async function clearHistory() {
    if (state.isClearing)
      return

    state.isClearing = true
    state.errorMessage = null
    try {
      await clipboard.clearHistory()
      state.clipboardItems = []
      state.total = 0
      ensureSelection()
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      state.isClearing = false
    }
  }

  function selectItem(item: PluginClipboardItem) {
    setSelection(item)
  }

  async function bulkDeleteSelected() {
    if (!state.multiSelectedKeys.length || state.bulkDeletePending)
      return

    state.bulkDeletePending = true
    state.errorMessage = null

    const targetKeys = new Set(state.multiSelectedKeys)
    const itemsToDelete = state.clipboardItems.filter((item: any) => targetKeys.has(getItemKey(item)) && item.id != null)

    try {
      for (const item of itemsToDelete)
        await clipboard.deleteItem({ id: Number(item.id) })

      state.clipboardItems = state.clipboardItems.filter((item: any) => !targetKeys.has(getItemKey(item)))
      const deletedCount = itemsToDelete.length
      if (deletedCount)
        state.total = Math.max(0, state.total - deletedCount)

      state.multiSelectedKeys = []
      if (state.selectedKey && targetKeys.has(state.selectedKey))
        ensureSelection()
      else
        ensureSelection(state.selectedKey ?? undefined)
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      state.bulkDeletePending = false
    }
  }

  async function bulkFavoriteSelected() {
    if (!state.multiSelectedKeys.length || state.bulkFavoritePending)
      return

    state.bulkFavoritePending = true
    state.errorMessage = null

    const targetKeys = new Set(state.multiSelectedKeys)
    const itemsToFavorite = state.clipboardItems.filter((item: any) => targetKeys.has(getItemKey(item)) && item.id != null)

    try {
      for (const item of itemsToFavorite)
        await clipboard.setFavorite({ id: Number(item.id), isFavorite: true })

      state.clipboardItems = state.clipboardItems.map((item: any) => {
        if (!targetKeys.has(getItemKey(item)))
          return item
        return {
          ...item,
          isFavorite: true,
        }
      })

      if (state.selectedItem && targetKeys.has(getItemKey(state.selectedItem)))
        state.selectedItem = { ...state.selectedItem, isFavorite: true }
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      state.bulkFavoritePending = false
    }
  }

  function handleClipboardChange(item: PluginClipboardItem) {
    const key = getItemKey(item)
    const index = state.clipboardItems.findIndex((existing: any) => getItemKey(existing) === key)
    if (index === -1) {
      state.clipboardItems.unshift(item)
      state.total += 1
    }
    else {
      state.clipboardItems.splice(index, 1, { ...state.clipboardItems[index], ...item })
    }

    state.hasReachedHistoryEnd = false
    ensureSelection(key)
  }

  async function bootstrap() {
    state.errorMessage = null
    try {
      box.clearInput()
      box.allowInput()
      await loadHistory({ reset: true, showInitialSpinner: true })
      stopClipboardListener = clipboard.onDidChange(handleClipboardChange)
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      state.isLoading = false
    }
  }

  onCoreBoxInputChange(async () => {
    await loadHistory({ reset: true, showInitialSpinner: true })
  })

  onMounted(async () => {
    await bootstrap()
    if (typeof document !== 'undefined')
      stopHotkeys = useEventListener(() => document.body, 'keydown', handleHotkeys)
  })

  onBeforeUnmount(() => {
    stopClipboardListener?.()
    stopHotkeys?.()
  })

  return Object.assign(state, {
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
    loadHistory,
    formatTimestamp,
  })
}

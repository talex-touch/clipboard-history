import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import {
  ClipboardTypePresets,
  onCoreBoxInputChange,
  onCoreBoxKeyEvent,
  useBox,
  useClipboard,
} from '@talex-touch/utils/plugin/sdk'
import structuredClonePolyfill from '@ungap/structured-clone'
import { useEventListener } from '@vueuse/core'
import {
  nextTick,
  onBeforeUnmount,
  reactive,
  toRaw,
  watch,
  watchEffect,
} from 'vue'
import { toast } from 'vue-sonner'
import { ensureTFileUrl } from '~/utils/tfile'
import { formatTimestamp, getItemKey } from './clipboardUtils'

type ClipboardClient = ReturnType<typeof useClipboard>
type ClipboardHistoryClient = ClipboardClient['history']

interface LoadHistoryOptions {
  reset?: boolean
  showInitialSpinner?: boolean
  ensureSelectionVisible?: boolean
  keyword?: string
}

interface HotkeyEventLike {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  target?: EventTarget | null
  preventDefault?: () => void
}

interface ForwardedHotkeyCache {
  signature: string
  at: number
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

function resolveCoreBoxInputKeyword(payload: unknown): string {
  if (!payload || typeof payload !== 'object')
    return ''

  const root = payload as Record<string, unknown>
  const source = (root.data && typeof root.data === 'object'
    ? root.data
    : root) as Record<string, unknown>

  if (typeof source.input === 'string')
    return source.input

  const query = source.query
  if (query && typeof query === 'object') {
    const text = (query as Record<string, unknown>).text
    if (typeof text === 'string')
      return text
  }

  return ''
}

function resolveCoreBoxForwardedKey(payload: unknown): HotkeyEventLike | null {
  if (!payload || typeof payload !== 'object')
    return null

  const root = payload as Record<string, unknown>
  const source = (root.data && typeof root.data === 'object'
    ? root.data
    : root) as Record<string, unknown>

  const key = source.key
  if (typeof key !== 'string' || !key.trim())
    return null

  return {
    key,
    metaKey: Boolean(source.metaKey),
    ctrlKey: Boolean(source.ctrlKey),
    altKey: Boolean(source.altKey),
    shiftKey: Boolean(source.shiftKey),
  }
}

function getImageOriginalUrl(item: PluginClipboardItem | null): string {
  if (!item || !item.meta || typeof item.meta !== 'object')
    return ''

  const raw = (item.meta as Record<string, unknown>).image_original_url
  if (typeof raw === 'string' && raw.trim())
    return raw.trim()

  return ''
}

function shouldIgnoreForwardedEditingShortcut(event: HotkeyEventLike): boolean {
  if (!(event.metaKey || event.ctrlKey))
    return false

  const key = event.key.toLowerCase()
  return ['a', 'c', 'v', 'x', 'z', 'y'].includes(key)
}

export function useClipboardManager() {
  const clipboard = import.meta.env.SSR ? null : useClipboard()
  const clipboardHistory = (clipboard?.history ?? {}) as ClipboardHistoryClient
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
    queryKeyword: '',
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
  let activeHistoryRequestId = 0
  let lastForwardedHotkey: ForwardedHotkeyCache | null = null

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

  function cloneClipboardItem(item: PluginClipboardItem): PluginClipboardItem {
    const rawItem = toRaw(item)
    return structuredClonePolyfill(rawItem)
  }

  function hideCoreBoxWindow() {
    try {
      box.hide()
    }
    catch (error) {
      console.error('[ClipboardManager] Failed to hide CoreBox', error)
    }
  }

  async function resolveImageSource(item: PluginClipboardItem): Promise<string> {
    if (item.id != null && clipboard?.getHistoryImageUrl) {
      const url = await clipboard.getHistoryImageUrl(Number(item.id))
      if (url)
        return url
    }

    const meta = item.meta && typeof item.meta === 'object' ? item.meta : null
    const metaUrl = meta && 'image_original_url' in meta ? (meta as Record<string, unknown>).image_original_url : null
    if (typeof metaUrl === 'string' && metaUrl.trim())
      return metaUrl.trim()

    const content = (item.content ?? '').trim()
    if (!content)
      return ''
    return content.startsWith('data:') ? content : ensureTFileUrl(content)
  }

  function patchItemMeta(itemKey: string, patch: Record<string, unknown>) {
    const targetIndex = state.clipboardItems.findIndex((entry: any) => getItemKey(entry) === itemKey)
    if (targetIndex === -1)
      return

    const target = state.clipboardItems[targetIndex]
    const baseMeta = target.meta && typeof target.meta === 'object' ? target.meta : {}
    const nextMeta = { ...(baseMeta as Record<string, unknown>), ...patch }
    state.clipboardItems.splice(targetIndex, 1, {
      ...target,
      meta: nextMeta,
    })

    if (state.selectedKey === itemKey && state.selectedItem) {
      const selectedBaseMeta = state.selectedItem.meta && typeof state.selectedItem.meta === 'object'
        ? state.selectedItem.meta
        : {}
      state.selectedItem = {
        ...state.selectedItem,
        meta: { ...(selectedBaseMeta as Record<string, unknown>), ...patch },
      }
    }
  }

  async function ensureImageOriginalUrl(item: PluginClipboardItem) {
    if (item.type !== 'image' || item.id == null)
      return

    if (getImageOriginalUrl(item))
      return

    if (!clipboard?.getHistoryImageUrl)
      return

    try {
      const url = await clipboard.getHistoryImageUrl(Number(item.id))
      if (!url)
        return
      patchItemMeta(getItemKey(item), { image_original_url: url })
    }
    catch {
      // ignore image url resolve errors
    }
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
    void ensureImageOriginalUrl(item)
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

  function selectByIndex(index: number, allowWrap = true) {
    if (!state.clipboardItems.length)
      return

    let normalizedIndex: number
    if (allowWrap) {
      normalizedIndex = (index + state.clipboardItems.length) % state.clipboardItems.length
    }
    else {
      // Clamp to valid range without wrapping
      normalizedIndex = Math.max(0, Math.min(index, state.clipboardItems.length - 1))
    }
    const nextItem = state.clipboardItems[normalizedIndex]
    if (nextItem)
      setSelection(nextItem)
  }

  function preventHotkeyDefault(event: HotkeyEventLike) {
    event.preventDefault?.()
  }

  function getHotkeySignature(event: HotkeyEventLike): string {
    return `${event.key}|${event.metaKey ? 1 : 0}|${event.ctrlKey ? 1 : 0}|${event.altKey ? 1 : 0}|${event.shiftKey ? 1 : 0}`
  }

  function markForwardedHotkey(event: HotkeyEventLike) {
    lastForwardedHotkey = {
      signature: getHotkeySignature(event),
      at: Date.now(),
    }
  }

  function shouldSkipDomHotkey(event: KeyboardEvent): boolean {
    if (!lastForwardedHotkey)
      return false

    const dedupeWindowMs = 160
    const now = Date.now()
    if (now - lastForwardedHotkey.at > dedupeWindowMs)
      return false

    return getHotkeySignature(event) === lastForwardedHotkey.signature
  }

  function handleArrowNavigation(event: HotkeyEventLike) {
    if (!state.clipboardItems.length)
      return

    if (event.key === 'ArrowDown') {
      preventHotkeyDefault(event)
      // Allow wrap from last to first when pressing down
      selectByIndex((state.activeIndex === -1 ? 0 : state.activeIndex) + 1, true)
    }
    else if (event.key === 'ArrowUp') {
      preventHotkeyDefault(event)
      // Do NOT allow wrap from first to last when pressing up
      selectByIndex((state.activeIndex === -1 ? 0 : state.activeIndex) - 1, false)
    }
    else if (event.key === 'Home') {
      preventHotkeyDefault(event)
      selectByIndex(0, false)
    }
    else if (event.key === 'End') {
      preventHotkeyDefault(event)
      selectByIndex(state.clipboardItems.length - 1, false)
    }
  }

  function handleQuickSelect(event: HotkeyEventLike) {
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

  async function handleHotkeys(event: HotkeyEventLike) {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable)
      return

    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && (event.key === 's' || event.key === 'S')) {
      preventHotkeyDefault(event)
      await toggleFavorite()
      return
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
      preventHotkeyDefault(event)
      const applied = await applyItem()
      if (applied)
        await hideCoreBoxWindow()
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
      keyword,
    } = options
    const requestId = ++activeHistoryRequestId
    const nextKeyword = typeof keyword === 'string' ? keyword : state.queryKeyword

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
      const payload = await clipboardHistory.getHistory({ page: targetPage, keyword: nextKeyword })
      if (requestId !== activeHistoryRequestId)
        return
      const historyItems = payload.history ?? []
      const previousLength = reset ? 0 : state.clipboardItems.length
      const resolvedPage = typeof payload.page === 'number' ? payload.page : targetPage
      const resolvedPageSize = typeof payload.pageSize === 'number' ? payload.pageSize : state.pageSize

      state.page = resolvedPage
      state.total = payload.total
      state.pageSize = resolvedPageSize

      state.clipboardItems = reset ? historyItems : mergeHistory(state.clipboardItems, historyItems)
      const nextLength = state.clipboardItems.length

      if (reset) {
        const hasMore
          = resolvedPageSize > 0
            ? historyItems.length >= resolvedPageSize
            : historyItems.length > 0
        state.hasReachedHistoryEnd = !hasMore
      }
      else {
        const reachedEnd
          = historyItems.length === 0
            || resolvedPage < targetPage
            || (resolvedPageSize > 0 && historyItems.length < resolvedPageSize)
            || nextLength === previousLength

        state.hasReachedHistoryEnd = !!reachedEnd
      }

      if (ensureSelectionVisible)
        ensureSelection()
    }
    catch (error) {
      if (requestId !== activeHistoryRequestId)
        return
      state.errorMessage = formatError(error)
    }
    finally {
      if (requestId === activeHistoryRequestId) {
        if (showInitialSpinner)
          state.isLoading = false
        if (!showInitialSpinner && !reset)
          state.isLoadingMore = false
      }
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

      // 优先使用新的 copyAndPaste API
      if (clipboard?.copyAndPaste) {
        let success = false
        if (item.type === 'image') {
          const imageSource = await resolveImageSource(item)
          if (!imageSource)
            throw new Error('无法解析图片内容')
          success = await clipboard.copyAndPaste({ image: imageSource, hideCoreBox: true })
        }
        else if (item.type === 'text' && item.rawContent) {
          success = await clipboard.copyAndPaste({
            text: item.content ?? '',
            html: item.rawContent,
            hideCoreBox: true,
          })
        }
        else if (item.type === 'files') {
          const files = parseFileListFromItem(item)
          if (files.length)
            success = await clipboard.copyAndPaste({ files, hideCoreBox: true })
          else
            success = await clipboard.copyAndPaste({ text: item.content ?? '', hideCoreBox: true })
        }
        else {
          success = await clipboard.copyAndPaste({ text: item.content ?? '', hideCoreBox: true })
        }
        if (!success)
          throw new Error('自动粘贴失败')
        toast.success('已粘贴到当前应用')
        return true
      }

      // 回退到旧的 applyToActiveApp API
      if (clipboardHistory.applyToActiveApp) {
        const success = await clipboardHistory.applyToActiveApp({
          item: payload,
          hideCoreBox: true,
        })
        if (!success)
          throw new Error('自动粘贴失败')
        toast.success('已粘贴到当前应用')
        return true
      }
      throw new Error('无法调用自动粘贴通道')
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

  async function toggleFavorite() {
    if (!state.selectedItem?.id || state.favoritePending)
      return

    state.favoritePending = true
    state.errorMessage = null
    const nextState = !state.selectedItem.isFavorite

    try {
      await clipboardHistory.setFavorite({
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
      toast.success(nextState ? '已添加到收藏' : '已取消收藏')
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
      await clipboardHistory.deleteItem({ id: Number(state.selectedItem.id) })

      state.clipboardItems = state.clipboardItems.filter((item: any) => getItemKey(item) !== key)
      state.total = Math.max(0, state.total - 1)
      ensureSelection()
      toast.success('已删除')
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
      await clipboardHistory.clearHistory()
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
        await clipboardHistory.deleteItem({ id: Number(item.id) })

      state.clipboardItems = state.clipboardItems.filter((item: any) => !targetKeys.has(getItemKey(item)))
      const deletedCount = itemsToDelete.length
      if (deletedCount)
        state.total = Math.max(0, state.total - deletedCount)

      state.multiSelectedKeys = []
      if (state.selectedKey && targetKeys.has(state.selectedKey))
        ensureSelection()
      else
        ensureSelection(state.selectedKey ?? undefined)
      toast.success(`已删除 ${deletedCount} 条记录`)
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
        await clipboardHistory.setFavorite({ id: Number(item.id), isFavorite: true })

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
      toast.success(`已收藏 ${itemsToFavorite.length} 条记录`)
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
      await box.allowInput()
      try {
        state.queryKeyword = await box.getInput()
      }
      catch {
        state.queryKeyword = ''
      }
      await loadHistory({ reset: true, showInitialSpinner: true })
      await box.allowClipboard(ClipboardTypePresets.ALL)
      stopClipboardListener = clipboardHistory.onDidChange(handleClipboardChange)
    }
    catch (error) {
      state.errorMessage = formatError(error)
    }
    finally {
      state.isLoading = false
    }
  }

  onCoreBoxInputChange(async (payload) => {
    const nextKeyword = resolveCoreBoxInputKeyword(payload)
    if (nextKeyword === state.queryKeyword)
      return
    state.queryKeyword = nextKeyword
    await loadHistory({ reset: true, showInitialSpinner: true })
  })

  onCoreBoxKeyEvent((payload) => {
    const forwarded = resolveCoreBoxForwardedKey(payload)
    if (!forwarded)
      return
    if (shouldIgnoreForwardedEditingShortcut(forwarded))
      return
    markForwardedHotkey(forwarded)
    void handleHotkeys(forwarded)
  })

  // 直接注册事件监听器，因为这个 composable 可能在 onMounted 回调中被调用
  // 在这种情况下，内部的 onMounted 不会被正确执行
  if (typeof document !== 'undefined' && !import.meta.env.SSR) {
    // 立即启动 bootstrap
    bootstrap()
    // 注册键盘事件监听器
    stopHotkeys = useEventListener(document, 'keydown', (event) => {
      if (shouldSkipDomHotkey(event))
        return
      void handleHotkeys(event)
    })
  }

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
    loadHistory,
    formatTimestamp,
  })
}

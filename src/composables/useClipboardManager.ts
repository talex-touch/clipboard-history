import type { PluginClipboardHistoryResponse, PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
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
import {
  getImageOriginalUrl,
  resolveClipboardDetailImageSource,
} from '~/utils/clipboard-image'
import { ensureTFileUrl } from '~/utils/tfile'
import { formatTimestamp, getItemKey } from './clipboardUtils'

type ClipboardClient = ReturnType<typeof useClipboard>
type ClipboardHistoryClient = ClipboardClient['history']

interface LoadHistoryOptions {
  reset?: boolean
  showInitialSpinner?: boolean
  ensureSelectionVisible?: boolean
  suppressError?: boolean
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

const COREBOX_TRIGGER_PREFIXES = ['clipboard-history', '剪贴板历史记录', '剪贴板']

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
    return normalizeCoreBoxKeyword(source.input)

  const query = source.query
  if (query && typeof query === 'object') {
    const text = (query as Record<string, unknown>).text
    if (typeof text === 'string')
      return normalizeCoreBoxKeyword(text)
  }

  return ''
}

function normalizeCoreBoxKeyword(input: string): string {
  const keyword = input.trim()
  if (!keyword)
    return ''

  const lowerKeyword = keyword.toLowerCase()
  for (const trigger of COREBOX_TRIGGER_PREFIXES) {
    const normalizedTrigger = trigger.trim()
    if (!normalizedTrigger)
      continue

    const lowerTrigger = normalizedTrigger.toLowerCase()
    if (lowerKeyword === lowerTrigger)
      return ''

    if (
      lowerKeyword.startsWith(`${lowerTrigger} `)
      || lowerKeyword.startsWith(`${lowerTrigger}:`)
      || lowerKeyword.startsWith(`${lowerTrigger}：`)
    ) {
      return keyword.slice(normalizedTrigger.length).trim()
    }
  }

  return keyword
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

function shouldIgnoreForwardedEditingShortcut(event: HotkeyEventLike): boolean {
  if (!(event.metaKey || event.ctrlKey))
    return false

  const key = event.key.toLowerCase()
  return ['a', 'c', 'v', 'x', 'z', 'y'].includes(key)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function pickFirstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim())
      return value.trim()
  }
  return ''
}

function parseMetaRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  return { ...(value as Record<string, unknown>) }
}

function parseMetadataString(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value.trim())
    return null

  try {
    return parseMetaRecord(JSON.parse(value))
  }
  catch {
    return null
  }
}

function normalizePluginHistoryItem(item: PluginClipboardItem): PluginClipboardItem {
  const itemRecord = item as unknown as Record<string, unknown>
  const meta: Record<string, unknown> = {
    ...(parseMetadataString(item.metadata) ?? {}),
    ...(parseMetaRecord(item.meta) ?? {}),
  }

  const imageOriginalUrl = pickFirstNonEmptyString(
    itemRecord.image_original_url,
    (meta as Record<string, unknown>).image_original_url,
  )
  if (imageOriginalUrl)
    meta.image_original_url = imageOriginalUrl

  const imagePreviewUrl = pickFirstNonEmptyString(
    itemRecord.image_preview_url,
    (meta as Record<string, unknown>).image_preview_url,
  )
  if (imagePreviewUrl)
    meta.image_preview_url = imagePreviewUrl

  const imageContentKind = pickFirstNonEmptyString(
    itemRecord.image_content_kind,
    (meta as Record<string, unknown>).image_content_kind,
  )
  if (imageContentKind)
    meta.image_content_kind = imageContentKind

  return {
    ...item,
    content: pickFirstNonEmptyString(item.content),
    thumbnail: pickFirstNonEmptyString(item.thumbnail) || null,
    rawContent: pickFirstNonEmptyString(item.rawContent) || null,
    sourceApp: pickFirstNonEmptyString(item.sourceApp) || null,
    meta: Object.keys(meta).length > 0 ? meta : null,
  }
}

function normalizeHistoryResponse(
  payload: PluginClipboardHistoryResponse | null | undefined,
  targetPage: number,
): PluginClipboardHistoryResponse {
  const history = Array.isArray(payload?.history)
    ? payload.history.map(item => normalizePluginHistoryItem(item))
    : []

  return {
    history,
    total: isFiniteNumber(payload?.total) ? Number(payload?.total) : history.length,
    page: isFiniteNumber(payload?.page) ? Number(payload?.page) : targetPage,
    pageSize: isFiniteNumber(payload?.pageSize) ? Number(payload?.pageSize) : 20,
  }
}

export function useClipboardManager() {
  const clipboard = import.meta.env.SSR ? null : useClipboard()
  const clipboardHistory = (clipboard?.history ?? {}) as ClipboardHistoryClient
  const box = useBox()

  function debugLog(stage: string, meta?: Record<string, unknown>) {
    const ts = new Date().toISOString()
    if (meta)
      // eslint-disable-next-line no-console
      console.debug(`[ClipboardManager][${ts}] ${stage}`, meta)
    else
      // eslint-disable-next-line no-console
      console.debug(`[ClipboardManager][${ts}] ${stage}`)
  }

  async function getHistoryImageUrlCompat(id: number): Promise<string> {
    const normalizedId = Number(id)
    if (!Number.isFinite(normalizedId))
      return ''

    try {
      const url = await clipboard?.getHistoryImageUrl?.(normalizedId)
      if (typeof url === 'string' && url.trim()) {
        debugLog('imageUrl:source', { source: 'sdk', id: normalizedId })
        return url.trim()
      }
    }
    catch (error) {
      debugLog('imageUrl:sdk-error', { id: normalizedId, error: formatError(error) })
    }

    debugLog('imageUrl:not-found', { id: normalizedId })
    return ''
  }

  async function getHistoryCompat(
    targetPage: number,
    nextKeyword: string,
  ): Promise<{ history: PluginClipboardItem[], total: number, page: number, pageSize: number }> {
    try {
      const sdkPayload = await clipboardHistory.getHistory({ page: targetPage, keyword: nextKeyword })
      const normalized = normalizeHistoryResponse(sdkPayload, targetPage)
      const imageSample = normalized.history.find((entry: PluginClipboardItem) => entry.type === 'image')
      if (imageSample) {
        debugLog('loadHistory:image-sample', {
          hasThumbnail: Boolean(imageSample.thumbnail),
          hasImageOriginalUrl: Boolean(getImageOriginalUrl(imageSample)),
          contentPrefix: imageSample.content?.slice(0, 24) ?? '',
        })
      }

      debugLog('loadHistory:source', { source: 'sdk' })
      return normalized
    }
    catch (error) {
      debugLog('loadHistory:sdk-error', { error: formatError(error) })
      return { history: [], total: 0, page: targetPage, pageSize: 20 }
    }
  }

  async function setFavoriteCompat(id: number, isFavorite: boolean): Promise<void> {
    await clipboardHistory.setFavorite({ id, isFavorite })
  }

  async function deleteItemCompat(id: number): Promise<void> {
    await clipboardHistory.deleteItem({ id })
  }

  async function clearHistoryCompat(): Promise<void> {
    await clipboardHistory.clearHistory()
  }

  async function copyAndPasteCompat(payload: Record<string, unknown>): Promise<boolean> {
    if (clipboard?.copyAndPaste)
      return clipboard.copyAndPaste(payload as any)
    return false
  }

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
  let clipboardFallbackTimer: number | null = null
  let clipboardFallbackRefreshPending = false
  let activeHistoryRequestId = 0
  let lastForwardedHotkey: ForwardedHotkeyCache | null = null

  debugLog('init', {
    hasClipboardSdk: Boolean(clipboard),
    hasHistoryApi: Boolean(clipboardHistory?.getHistory),
  })

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
    const metaUrl = getImageOriginalUrl(item)
    if (metaUrl)
      return ensureTFileUrl(metaUrl)

    if (item.id != null) {
      const url = await getHistoryImageUrlCompat(Number(item.id))
      if (url)
        return ensureTFileUrl(url)
    }

    const content = (item.content ?? '').trim()
    if (!content)
      return resolveClipboardDetailImageSource(item)
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

    try {
      const url = await getHistoryImageUrlCompat(Number(item.id))
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
      suppressError = false,
      keyword,
    } = options
    const requestId = ++activeHistoryRequestId
    const nextKeyword = typeof keyword === 'string' ? keyword : state.queryKeyword
    const startedAt = performance.now()
    debugLog('loadHistory:start', {
      requestId,
      reset,
      showInitialSpinner,
      ensureSelectionVisible,
      targetKeyword: nextKeyword,
      currentPage: state.page,
      currentTotal: state.total,
      canLoadMore: state.canLoadMore,
    })

    if (showInitialSpinner || reset)
      state.errorMessage = null

    if (reset) {
      state.page = 1
      state.hasReachedHistoryEnd = false
    }

    const targetPage = reset ? 1 : state.page + 1

    if (!reset && !state.canLoadMore) {
      debugLog('loadHistory:skip', {
        requestId,
        reason: 'no_more_data',
        currentPage: state.page,
        total: state.total,
        loaded: state.clipboardItems.length,
      })
      return
    }

    if (showInitialSpinner)
      state.isLoading = true
    else if (!reset)
      state.isLoadingMore = true

    try {
      const payload = await getHistoryCompat(targetPage, nextKeyword)
      if (requestId !== activeHistoryRequestId) {
        debugLog('loadHistory:stale-response', {
          requestId,
          activeHistoryRequestId,
          targetPage,
        })
        return
      }
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

      debugLog('loadHistory:success', {
        requestId,
        requestedPage: targetPage,
        resolvedPage,
        pageSize: resolvedPageSize,
        fetchedCount: historyItems.length,
        previousLength,
        nextLength,
        total: payload.total,
        hasReachedHistoryEnd: state.hasReachedHistoryEnd,
        durationMs: Math.round(performance.now() - startedAt),
      })
    }
    catch (error) {
      if (requestId !== activeHistoryRequestId) {
        debugLog('loadHistory:error-ignored', {
          requestId,
          activeHistoryRequestId,
          error: formatError(error),
        })
        return
      }
      if (!suppressError)
        state.errorMessage = formatError(error)
      debugLog('loadHistory:error', {
        requestId,
        targetPage,
        keyword: nextKeyword,
        error: formatError(error),
        durationMs: Math.round(performance.now() - startedAt),
      })
    }
    finally {
      if (requestId === activeHistoryRequestId) {
        if (showInitialSpinner)
          state.isLoading = false
        if (!showInitialSpinner && !reset)
          state.isLoadingMore = false

        debugLog('loadHistory:finalize', {
          requestId,
          isLoading: state.isLoading,
          isLoadingMore: state.isLoadingMore,
          page: state.page,
          loaded: state.clipboardItems.length,
          total: state.total,
        })
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
          success = await copyAndPasteCompat({ image: imageSource, hideCoreBox: true })
        }
        else if (item.type === 'text' && item.rawContent) {
          success = await copyAndPasteCompat({
            text: item.content ?? '',
            html: item.rawContent,
            hideCoreBox: true,
          })
        }
        else if (item.type === 'files') {
          const files = parseFileListFromItem(item)
          if (files.length)
            success = await copyAndPasteCompat({ files, hideCoreBox: true })
          else
            success = await copyAndPasteCompat({ text: item.content ?? '', hideCoreBox: true })
        }
        else {
          success = await copyAndPasteCompat({ text: item.content ?? '', hideCoreBox: true })
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
      await setFavoriteCompat(Number(state.selectedItem.id), nextState)

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
      await deleteItemCompat(Number(state.selectedItem.id))

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
      await clearHistoryCompat()
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
        await deleteItemCompat(Number(item.id))

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
        await setFavoriteCompat(Number(item.id), true)

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
    debugLog('stream:onDidChange', {
      key,
      type: item.type,
      mergedAtIndex: index,
      loaded: state.clipboardItems.length,
      total: state.total,
    })
  }

  async function refreshHistoryFromFallback() {
    if (clipboardFallbackRefreshPending)
      return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden')
      return

    clipboardFallbackRefreshPending = true
    try {
      await loadHistory({
        reset: true,
        showInitialSpinner: false,
        ensureSelectionVisible: true,
        suppressError: true,
      })
    }
    finally {
      clipboardFallbackRefreshPending = false
    }
  }

  function startClipboardPollingFallback(reason: unknown) {
    debugLog('stream:fallback-polling', { reason: formatError(reason) })
    if (clipboardFallbackTimer || typeof window === 'undefined')
      return

    clipboardFallbackTimer = window.setInterval(() => {
      void refreshHistoryFromFallback()
    }, 5000)
    void refreshHistoryFromFallback()
  }

  function stopClipboardPollingFallback() {
    if (!clipboardFallbackTimer)
      return
    window.clearInterval(clipboardFallbackTimer)
    clipboardFallbackTimer = null
  }

  function startClipboardChangeListener() {
    try {
      stopClipboardListener = clipboardHistory.onDidChange(handleClipboardChange)
      debugLog('bootstrap:stream-ready')
    }
    catch (error) {
      stopClipboardListener = null
      startClipboardPollingFallback(error)
    }
  }

  async function bootstrap() {
    state.errorMessage = null
    debugLog('bootstrap:start')
    try {
      await box.allowInput()
      try {
        state.queryKeyword = normalizeCoreBoxKeyword(await box.getInput())
        debugLog('bootstrap:input-ready', {
          queryKeyword: state.queryKeyword,
        })
      }
      catch {
        state.queryKeyword = ''
        debugLog('bootstrap:input-fallback-empty')
      }
      await loadHistory({ reset: true, showInitialSpinner: true })
      await box.allowClipboard(ClipboardTypePresets.ALL)
      startClipboardChangeListener()
    }
    catch (error) {
      state.errorMessage = formatError(error)
      debugLog('bootstrap:error', {
        error: state.errorMessage,
      })
    }
    finally {
      state.isLoading = false
      debugLog('bootstrap:done', {
        isLoading: state.isLoading,
        loaded: state.clipboardItems.length,
        total: state.total,
      })
    }
  }

  onCoreBoxInputChange(async (payload) => {
    const nextKeyword = resolveCoreBoxInputKeyword(payload)
    debugLog('input:change', {
      previousKeyword: state.queryKeyword,
      nextKeyword,
    })
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
    stopClipboardPollingFallback()
    stopHotkeys?.()
    debugLog('destroy')
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

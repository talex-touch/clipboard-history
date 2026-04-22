import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { ensureTFileUrl } from './tfile'

function readImageMetaString(item: PluginClipboardItem | null | undefined, key: string): string {
  if (!item?.meta || typeof item.meta !== 'object')
    return ''

  const raw = (item.meta as Record<string, unknown>)[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

function getTrimmedContent(item: PluginClipboardItem | null | undefined): string {
  return typeof item?.content === 'string' ? item.content.trim() : ''
}

function isRenderableImageUrl(value: string): boolean {
  return /^(?:data|https?|blob|tfile):/i.test(value)
}

function normalizeImageSource(value: string): string {
  if (!value)
    return ''
  if (/^tfile:/i.test(value))
    return ensureTFileUrl(value)
  return isRenderableImageUrl(value) ? value : ensureTFileUrl(value)
}

export function getImageOriginalUrl(item: PluginClipboardItem | null | undefined): string {
  return readImageMetaString(item, 'image_original_url')
}

export function getImagePreviewUrl(item: PluginClipboardItem | null | undefined): string {
  return readImageMetaString(item, 'image_preview_url')
}

export function getImageContentKind(item: PluginClipboardItem | null | undefined): string {
  return readImageMetaString(item, 'image_content_kind')
}

export function resolveClipboardDetailImageSource(item: PluginClipboardItem | null | undefined): string {
  if (!item)
    return ''

  const originalUrl = getImageOriginalUrl(item)
  if (originalUrl)
    return normalizeImageSource(originalUrl)

  const previewUrl = getImagePreviewUrl(item)
  const content = getTrimmedContent(item)
  const contentKind = getImageContentKind(item)

  if (content && contentKind && contentKind !== 'thumbnail')
    return normalizeImageSource(content)

  if (previewUrl)
    return normalizeImageSource(previewUrl)

  if (content)
    return normalizeImageSource(content)

  return ''
}

export function hasClipboardDetailImageSource(item: PluginClipboardItem | null | undefined): boolean {
  if (!item || item.type !== 'image')
    return false

  const thumbnail = typeof item.thumbnail === 'string' ? item.thumbnail.trim() : ''
  if (getImageOriginalUrl(item))
    return true

  const previewUrl = getImagePreviewUrl(item)
  if (previewUrl && previewUrl !== thumbnail)
    return true

  const content = getTrimmedContent(item)
  if (!content)
    return false

  if (getImageContentKind(item) === 'thumbnail')
    return false

  return content !== thumbnail
}

export function resolveClipboardListImageSource(item: PluginClipboardItem | null | undefined): string | null {
  if (!item)
    return null

  if (typeof item.thumbnail === 'string' && item.thumbnail.trim())
    return item.thumbnail.trim()

  const previewUrl = getImagePreviewUrl(item)
  if (previewUrl)
    return normalizeImageSource(previewUrl)

  const content = getTrimmedContent(item)
  if (!content)
    return null

  return normalizeImageSource(content)
}

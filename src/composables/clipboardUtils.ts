import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'

export function getItemKey(item: PluginClipboardItem) {
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

export function formatTimestamp(timestamp: PluginClipboardItem['timestamp']) {
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

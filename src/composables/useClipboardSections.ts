import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed } from 'vue'

const DAY_IN_MS = 86_400_000

type SectionKey = 'today' | 'threeDays' | 'oneWeek' | 'oneMonth' | 'lastMonth' | 'threeMonths' | 'forever'

export interface SectionDefinition {
  key: SectionKey
  title: string
}

export interface SectionEntry {
  item: PluginClipboardItem
  globalIndex: number
}

export interface GroupedSection extends SectionDefinition {
  items: SectionEntry[]
}

export interface UseClipboardSectionsConfig {
  items: () => PluginClipboardItem[]
  sections: SectionDefinition[]
}

function toTimestampMs(value: PluginClipboardItem['timestamp']): number {
  if (value instanceof Date)
    return value.getTime()
  if (typeof value === 'number')
    return value
  if (typeof value === 'string') {
    const parsed = Number(new Date(value))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function useClipboardSections(config: UseClipboardSectionsConfig) {
  const sortedItems = computed(() =>
    [...config.items()].sort((a, b) => toTimestampMs(b.timestamp) - toTimestampMs(a.timestamp)),
  )

  const groupedSections = computed<GroupedSection[]>(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTodayMs = startOfToday.getTime()
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfCurrentMonthMs = startOfCurrentMonth.getTime()
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const startOfLastMonthMs = startOfLastMonth.getTime()
    const startOfThreeMonths = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const startOfThreeMonthsMs = startOfThreeMonths.getTime()

    const sectionMap = new Map<SectionKey, SectionEntry[]>(
      config.sections.map(section => [section.key, []]),
    )

    const resolveSectionKey = (item: PluginClipboardItem): SectionKey => {
      const milliseconds = toTimestampMs(item.timestamp)
      if (!Number.isFinite(milliseconds) || milliseconds <= 0)
        return 'forever'

      if (milliseconds >= startOfTodayMs)
        return 'today'
      if (milliseconds >= startOfTodayMs - 3 * DAY_IN_MS)
        return 'threeDays'
      if (milliseconds >= startOfTodayMs - 7 * DAY_IN_MS)
        return 'oneWeek'
      if (milliseconds >= startOfCurrentMonthMs)
        return 'oneMonth'
      if (milliseconds >= startOfLastMonthMs)
        return 'lastMonth'
      if (milliseconds >= startOfThreeMonthsMs)
        return 'threeMonths'
      return 'forever'
    }

    sortedItems.value.forEach((item, index) => {
      const key = resolveSectionKey(item)
      const bucket = sectionMap.get(key)
      if (bucket)
        bucket.push({ item, globalIndex: index })
    })

    return config.sections
      .map(section => ({
        ...section,
        items: sectionMap.get(section.key) ?? [],
      }))
      .filter(section => section.items.length > 0)
  })

  return {
    groupedSections,
  }
}

export { toTimestampMs }

import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed, reactive, ref } from 'vue'

type FilterValue = 'all' | 'favorites' | 'text' | 'image' | 'files' | 'url' | 'application'

interface FilterOption {
  value: FilterValue
  label: string
  icon: string
}

export interface FilterMenuItem extends FilterOption {
  count: number
}

export interface UseClipboardFiltersConfig {
  items: () => PluginClipboardItem[]
  filterOptions: FilterOption[]
}

export function useClipboardFilters(config: UseClipboardFiltersConfig) {
  const selectedFilter = ref<FilterValue>('all')
  const isPanelOpen = ref(false)

  const filterCounts = computed<Record<FilterValue, number>>(() => {
    const counts: Record<FilterValue, number> = reactive({
      all: config.items().length,
      favorites: 0,
      text: 0,
      image: 0,
      files: 0,
      url: 0,
      application: 0,
    })

    for (const item of config.items()) {
      if (item.isFavorite)
        counts.favorites += 1

      switch (item.type) {
        case 'text':
          counts.text += 1
          break
        case 'image':
          counts.image += 1
          break
        case 'url':
          counts.url += 1
          break
        case 'application':
          counts.application += 1
          break
        case 'file':
        case 'files':
          counts.files += 1
          break
        default:
          break
      }
    }

    return counts
  })

  const filteredItems = computed(() => {
    const activeFilter = selectedFilter.value
    const allItems = config.items()

    if (activeFilter === 'all')
      return allItems

    if (activeFilter === 'favorites')
      return allItems.filter(item => item.isFavorite)

    if (activeFilter === 'files')
      return allItems.filter(item => item.type === 'file' || item.type === 'files')

    return allItems.filter(item => item.type === activeFilter)
  })

  const filterMenuItems = computed<FilterMenuItem[]>(() =>
    config.filterOptions.map(option => ({
      ...option,
      count: filterCounts.value[option.value],
    })),
  )

  const hasActiveFilter = computed(() => selectedFilter.value !== 'all')

  function setFilter(filter: FilterValue) {
    if (filter !== 'all' && filterCounts.value[filter] === 0)
      return
    selectedFilter.value = filter
    isPanelOpen.value = false
  }

  function togglePanel() {
    isPanelOpen.value = !isPanelOpen.value
  }

  function closePanel() {
    isPanelOpen.value = false
  }

  return {
    filteredItems,
    filterCounts,
    filterMenuItems,
    hasActiveFilter,
    selectedFilter,
    isPanelOpen,
    setFilter,
    togglePanel,
    closePanel,
  }
}

export type { FilterOption, FilterValue }

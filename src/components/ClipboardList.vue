<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import type { FilterOption } from '~/composables/useClipboardFilters'
import type { SectionDefinition } from '~/composables/useClipboardSections'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'
import ClipboardEmptyState from '~/components/clipboard-list/ClipboardEmptyState.vue'
import ClipboardItemCard from '~/components/clipboard-list/ClipboardItemCard.vue'
import ClipboardListFilterPanel from '~/components/clipboard-list/ClipboardListFilterPanel.vue'
import ClipboardListHeader from '~/components/clipboard-list/ClipboardListHeader.vue'
import ClipboardLoadMore from '~/components/clipboard-list/ClipboardLoadMore.vue'
import ClipboardSection from '~/components/clipboard-list/ClipboardSection.vue'
import { useClipboardFilters } from '~/composables/useClipboardFilters'
import { getItemKey } from '~/composables/useClipboardManager'
import { useClipboardSections } from '~/composables/useClipboardSections'

type FilterValue = ReturnType<typeof useClipboardFilters>['selectedFilter']['value']

const props = defineProps<{
  items: PluginClipboardItem[]
  selectedKey: string | null
  total: number
  pageSize: number
  isLoading: boolean
  isLoadingMore: boolean
  isClearing: boolean
  canLoadMore: boolean
  errorMessage: string | null
  formatTimestamp: (timestamp: PluginClipboardItem['timestamp']) => string
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
  (event: 'refresh'): void
  (event: 'clear'): void
  (event: 'loadMore'): void
}>()

const filterOptions: FilterOption[] = [
  { value: 'all', label: '全部内容', icon: 'i-carbon-list' },
  { value: 'favorites', label: '仅收藏', icon: 'i-carbon-star' },
  { value: 'text', label: '仅文本', icon: 'i-carbon-text-align-left' },
  { value: 'image', label: '仅图片', icon: 'i-carbon-image' },
  { value: 'files', label: '仅文件', icon: 'i-carbon-document' },
  { value: 'url', label: '仅链接', icon: 'i-carbon-link' },
  { value: 'application', label: '仅应用数据', icon: 'i-carbon-application-web' },
]

const sectionDefinitions: SectionDefinition[] = [
  { key: 'today', title: '今天' },
  { key: 'threeDays', title: '3天内' },
  { key: 'oneWeek', title: '1周内' },
  { key: 'oneMonth', title: '1月内' },
  { key: 'lastMonth', title: '上个月' },
  { key: 'threeMonths', title: '3个月内' },
  { key: 'forever', title: '永久' },
]

const scrollAreaRef = ref<HTMLElement | null>(null)
const filterControlsRef = ref<HTMLElement | null>(null)

const filterState = useClipboardFilters({
  items: () => props.items,
  filterOptions,
})

const { groupedSections } = useClipboardSections({
  items: () => filterState.filteredItems.value,
  sections: sectionDefinitions,
})

const summaryText = computed(() => {
  if (!props.total)
    return '暂无记录'

  if (!filterState.hasActiveFilter.value)
    return `共 ${props.total} 条记录`

  return `筛选结果 ${filterState.filteredItems.value.length} 条 / 总 ${props.total} 条`
})

const activeFilterLabel = computed(() => {
  const active = filterOptions.find(option => option.value === filterState.selectedFilter.value)
  return active ? `${active.label}` : '筛选'
})

const hasItems = computed(() => filterState.filteredItems.value.length > 0)

onClickOutside(filterControlsRef, () => {
  if (filterState.isPanelOpen.value)
    filterState.closePanel()
})

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && filterState.isPanelOpen.value)
    filterState.closePanel()
})

function handleSelect(item: PluginClipboardItem) {
  emit('select', item)
}

function handleRefresh() {
  emit('refresh')
}

function handleClear() {
  emit('clear')
}

function handleLoadMore() {
  emit('loadMore')
  if (scrollAreaRef.value)
    scrollAreaRef.value.scrollTop = scrollAreaRef.value.scrollHeight
}

function handleFilterChange(value: FilterValue) {
  filterState.setFilter(value)
  if (scrollAreaRef.value)
    scrollAreaRef.value.scrollTo({ top: 0, behavior: 'smooth' })
}

function toggleFilterPanel() {
  filterState.togglePanel()
}
</script>

<template>
  <div
    class="ClipboardList items-between h-full flex flex-col justify-center gap-2 overflow-hidden py-2"
    role="listbox"
    tabindex="0"
    :aria-activedescendant="selectedKey ? `clipboard-item-${selectedKey}` : undefined"
  >
    <div ref="filterControlsRef" class="px-2">
      <ClipboardListHeader
        :summary-text="summaryText"
        :is-loading="isLoading"
        :active-filter-label="activeFilterLabel"
        :has-active-filter="filterState.hasActiveFilter.value"
        :is-clearing="isClearing"
        :has-items="hasItems"
        @toggle-filter="toggleFilterPanel"
        @refresh="handleRefresh"
        @clear="handleClear"
      />

      <ClipboardListFilterPanel
        v-if="filterState.isPanelOpen.value"
        :items="filterState.filterMenuItems.value"
        :selected="filterState.selectedFilter.value"
        @select="handleFilterChange"
      />
    </div>

    <div v-if="errorMessage" class="list-error" role="alert">
      <span class="i-carbon-warning" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>

    <div ref="scrollAreaRef" class="h-full overflow-y-auto" tabindex="-1">
      <template v-if="hasItems">
        <ClipboardSection
          v-for="section in groupedSections"
          :key="section.key"
          :title="section.title"
          :count="section.items.length"
        >
          <ClipboardItemCard
            v-for="entry in section.items"
            :key="getItemKey(entry.item)"
            :item="entry.item"
            :index="entry.globalIndex"
            :is-active="selectedKey === getItemKey(entry.item)"
            :format-timestamp="formatTimestamp"
            @select="handleSelect"
          />
        </ClipboardSection>
      </template>
      <ClipboardEmptyState v-else :is-loading="isLoading" />

      <ClipboardLoadMore
        :can-load-more="canLoadMore"
        :is-loading="isLoading"
        :is-loading-more="isLoadingMore"
        @load-more="handleLoadMore"
      />
    </div>
  </div>
</template>

<style scoped>
.list-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(248, 113, 113, 0.12);
  color: #b91c1c;
  font-size: 0.82rem;
}
</style>

<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import type { FilterOption } from '~/composables/useClipboardFilters'
import type { SectionDefinition } from '~/composables/useClipboardSections'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ClipboardEmptyState from '~/components/clipboard-list/ClipboardEmptyState.vue'
import ClipboardItemCard from '~/components/clipboard-list/ClipboardItemCard.vue'
import ClipboardListFilterPanel from '~/components/clipboard-list/ClipboardListFilterPanel.vue'
import ClipboardListHeader from '~/components/clipboard-list/ClipboardListHeader.vue'
import ClipboardLoadMore from '~/components/clipboard-list/ClipboardLoadMore.vue'
import ClipboardSection from '~/components/clipboard-list/ClipboardSection.vue'
import { getItemKey } from '~/composables/clipboardUtils'
import { useClipboardFilters } from '~/composables/useClipboardFilters'
import { useClipboardSections } from '~/composables/useClipboardSections'
import { useCommandPalette } from '~/composables/useCommandPalette'

type FilterValue = ReturnType<typeof useClipboardFilters>['selectedFilter']['value']

const props = defineProps<{
  items: PluginClipboardItem[]
  selectedKey: string | null
  total: number
  pageSize: number
  isLoading: boolean
  isLoadingMore: boolean
  canLoadMore: boolean
  multiSelectMode: boolean
  multiSelectedKeys: string[]
  multiSelectedCount: number
  bulkDeletePending: boolean
  bulkFavoritePending: boolean
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
  (event: 'refresh'): void
  (event: 'loadMore'): void
  (event: 'toggleMultiSelectMode'): void
  (event: 'toggleMultiSelectItem', item: PluginClipboardItem): void
  (event: 'bulkDeleteSelected'): void
  (event: 'bulkFavoriteSelected'): void
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

const scrollAreaRef = ref<HTMLElement>()
const filterControlsRef = ref<HTMLElement>()
const filterPanelRef = ref<HTMLElement>()
const filterPanelStyle = ref<Record<string, string>>({})
const shouldDisableLoadMore = ref(false)
const pendingFilteredLoad = ref(false)
const baselineFilteredCount = ref(0)
const footerPortalReady = ref(false)
const footerPortalSelector = '#clipboard-footer-left'

const filterState = useClipboardFilters({
  items: () => props.items,
  filterOptions,
})

const palette = useCommandPalette()

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
const multiSelectedSet = computed(() => new Set(props.multiSelectedKeys))

function updateFilterPanelPosition() {
  if (!filterState.isPanelOpen.value || typeof window === 'undefined')
    return

  const margin = 12
  const fallbackWidth = 260
  const viewportWidth = window.innerWidth
  // const viewportHeight = window.innerHeight
  const trigger = filterControlsRef.value

  if (!trigger) {
    filterPanelStyle.value = {
      position: 'fixed',
      top: `${margin}px`,
      left: `${margin}px`,
      width: `${fallbackWidth}px`,
      maxHeight: `calc(100vh - ${margin * 2}px)`,
    }
    return
  }

  const rect = trigger.getBoundingClientRect()
  const width = Math.min(fallbackWidth, viewportWidth - margin * 2)
  const left = Math.min(
    Math.max(rect.left, margin),
    viewportWidth - margin - width,
  )
  const panelHeight = filterPanelRef.value?.offsetHeight ?? fallbackWidth
  const top = rect.top - margin - panelHeight
  const clampedTop = Math.max(margin, top - 48)

  filterPanelStyle.value = {
    position: 'fixed',
    top: `${clampedTop}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `calc(100vh - ${margin * 2}px)`,
  }
}

if (typeof document !== 'undefined') {
  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && filterState.isPanelOpen.value)
      filterState.closePanel()

    // Prevent default scroll behavior for arrow keys to allow list navigation
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      const target = event.target as HTMLElement | null
      if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA' && !target?.isContentEditable) {
        event.preventDefault()
      }
    }
  })

  useEventListener(document.defaultView ?? window, 'resize', () => {
    if (filterState.isPanelOpen.value)
      updateFilterPanelPosition()
  })
}

watch(() => filterState.isPanelOpen.value, async (open) => {
  if (open) {
    await nextTick()
    updateFilterPanelPosition()
  }
})

onClickOutside(filterPanelRef, () => {
  if (filterState.isPanelOpen.value)
    filterState.closePanel()
}, { ignore: [filterControlsRef] })

onMounted(() => {
  if (typeof document === 'undefined')
    return
  footerPortalReady.value = !!document.querySelector(footerPortalSelector)
})

function handleSelect(item: PluginClipboardItem) {
  emit('select', item)
}

function handleRefresh() {
  emit('refresh')
}

function handleLoadMore() {
  if (!props.canLoadMore || props.isLoadingMore || shouldDisableLoadMore.value)
    return

  if (filterState.hasActiveFilter.value) {
    baselineFilteredCount.value = filterState.filteredItems.value.length
    pendingFilteredLoad.value = true
  }
  emit('loadMore')
}

function handleFilterChange(value: FilterValue) {
  filterState.setFilter(value)
  if (scrollAreaRef.value)
    scrollAreaRef.value.scrollTo({ top: 0, behavior: 'smooth' })
}

function toggleFilterPanel() {
  filterState.togglePanel()
}

function handleToggleMultiSelectMode() {
  emit('toggleMultiSelectMode')
}

function handleToggleMultiSelectItem(item: PluginClipboardItem) {
  emit('toggleMultiSelectItem', item)
}

function handleBulkDeleteSelected() {
  emit('bulkDeleteSelected')
}

function handleBulkFavoriteSelected() {
  emit('bulkFavoriteSelected')
}

function isItemInMultiSelection(item: PluginClipboardItem) {
  return multiSelectedSet.value.has(getItemKey(item))
}

if (palette) {
  palette.register({
    id: 'clipboard.list.refresh',
    group: '列表',
    title: '刷新历史',
    description: () => props.isLoading ? '正在刷新…' : '重新拉取剪贴板记录',
    icon: 'i-carbon-renew',
    enabled: () => !props.isLoading,
    action: handleRefresh,
  })

  palette.register({
    id: 'clipboard.list.filter',
    group: '列表',
    title: () => (filterState.isPanelOpen.value ? '关闭筛选' : '打开筛选'),
    description: () => `当前：${activeFilterLabel.value}`,
    icon: 'i-carbon-filter',
    action: toggleFilterPanel,
  })

  palette.register({
    id: 'clipboard.list.multi-select',
    group: '列表',
    title: () => (props.multiSelectMode ? '退出多选' : '进入多选'),
    description: () => {
      if (!props.multiSelectMode)
        return hasItems.value ? '选择多个条目后批量操作' : '暂无内容'
      return props.multiSelectedCount ? `已选择 ${props.multiSelectedCount} 项` : '已开启多选'
    },
    icon: () => (props.multiSelectMode ? 'i-carbon-checkbox-checked-filled' : 'i-carbon-checkbox-multiple'),
    enabled: () => hasItems.value || props.multiSelectMode,
    action: handleToggleMultiSelectMode,
  })

  palette.register({
    id: 'clipboard.list.bulk-delete',
    group: '多选',
    title: () => (props.bulkDeletePending ? '删除所选（处理中…）' : '删除所选'),
    description: () => `已选择 ${props.multiSelectedCount} 项`,
    icon: 'i-carbon-trash-can',
    danger: true,
    enabled: () => props.multiSelectMode && props.multiSelectedCount > 0 && !props.bulkDeletePending,
    action: handleBulkDeleteSelected,
  })

  palette.register({
    id: 'clipboard.list.bulk-favorite',
    group: '多选',
    title: () => (props.bulkFavoritePending ? '批量收藏（处理中…）' : '批量收藏'),
    description: () => `已选择 ${props.multiSelectedCount} 项`,
    icon: 'i-carbon-star',
    enabled: () => props.multiSelectMode && props.multiSelectedCount > 0 && !props.bulkFavoritePending,
    action: handleBulkFavoriteSelected,
  })
}

watch(() => filterState.selectedFilter.value, () => {
  shouldDisableLoadMore.value = false
  pendingFilteredLoad.value = false
})

watch(() => filterState.filteredItems.value.length, (current, previous) => {
  if (current > previous)
    shouldDisableLoadMore.value = false
})

watch(() => props.isLoadingMore, (isLoadingMore, wasLoadingMore) => {
  if (!filterState.hasActiveFilter.value) {
    pendingFilteredLoad.value = false
    return
  }

  if (wasLoadingMore && !isLoadingMore && pendingFilteredLoad.value) {
    const currentCount = filterState.filteredItems.value.length
    if (currentCount <= baselineFilteredCount.value)
      shouldDisableLoadMore.value = true
    pendingFilteredLoad.value = false
  }
})

const canDisplayLoadMore = computed(() => props.canLoadMore && !shouldDisableLoadMore.value)
</script>

<template>
  <div
    class="ClipboardList items-between h-full flex flex-col justify-center gap-2 overflow-hidden"
    role="listbox"
    tabindex="0"
    :aria-activedescendant="selectedKey ? `clipboard-item-${selectedKey}` : undefined"
    :aria-multiselectable="multiSelectMode || undefined"
  >
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
            :is-multi-select-mode="multiSelectMode"
            :is-multi-selected="isItemInMultiSelection(entry.item)"
            @select="handleSelect"
            @toggle-multi-select="handleToggleMultiSelectItem"
          />
        </ClipboardSection>
      </template>
      <ClipboardEmptyState v-else :is-loading="isLoading" />

      <ClipboardLoadMore
        :can-load-more="canDisplayLoadMore"
        :is-loading="isLoading"
        :is-loading-more="isLoadingMore"
        @load-more="handleLoadMore"
      />
    </div>

    <Teleport v-if="footerPortalReady" :to="footerPortalSelector">
      <div ref="filterControlsRef" class="footer-controls px-2">
        <div class="footer-inline">
          <ClipboardListHeader
            :summary-text="summaryText"
            :is-loading="isLoading"
            :active-filter-label="activeFilterLabel"
            :has-active-filter="filterState.hasActiveFilter.value"
            :has-items="hasItems"
            :multi-select-mode="multiSelectMode"
            :multi-selected-count="multiSelectedCount"
            :show-refresh="false"
            :show-multi-select-toggle="false"
            :show-command-palette-trigger="true"
            @toggle-filter="toggleFilterPanel"
            @refresh="handleRefresh"
            @toggle-multi-select="handleToggleMultiSelectMode"
          />
        </div>
      </div>
    </Teleport>

    <div v-else ref="filterControlsRef" class="footer-controls px-2">
      <div class="footer-inline">
        <ClipboardListHeader
          :summary-text="summaryText"
          :is-loading="isLoading"
          :active-filter-label="activeFilterLabel"
          :has-active-filter="filterState.hasActiveFilter.value"
          :has-items="hasItems"
          :multi-select-mode="multiSelectMode"
          :multi-selected-count="multiSelectedCount"
          :show-refresh="false"
          :show-multi-select-toggle="false"
          :show-command-palette-trigger="true"
          @toggle-filter="toggleFilterPanel"
          @refresh="handleRefresh"
          @toggle-multi-select="handleToggleMultiSelectMode"
        />
      </div>
    </div>

    <Teleport to="body">
      <ClipboardListFilterPanel
        v-if="filterState.isPanelOpen.value"
        ref="filterPanelRef"
        :items="filterState.filterMenuItems.value"
        :selected="filterState.selectedFilter.value"
        :panel-style="filterPanelStyle"
        @select="handleFilterChange"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.footer-controls {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.footer-inline {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  width: 100%;
  min-width: 0;
  white-space: nowrap;
}
</style>

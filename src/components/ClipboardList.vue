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
  canLoadMore: boolean
  errorMessage: string | null
  multiSelectMode: boolean
  multiSelectedKeys: string[]
  multiSelectedCount: number
  bulkDeletePending: boolean
  bulkFavoritePending: boolean
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
  (event: 'apply', item: PluginClipboardItem): void
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
const multiSelectedSet = computed(() => new Set(props.multiSelectedKeys))

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

function handleApply(item: PluginClipboardItem) {
  emit('apply', item)
}

function handleRefresh() {
  emit('refresh')
}

function handleLoadMore() {
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
</script>

<template>
  <div
    class="ClipboardList items-between h-full flex flex-col justify-center gap-2 overflow-hidden"
    role="listbox"
    tabindex="0"
    :aria-activedescendant="selectedKey ? `clipboard-item-${selectedKey}` : undefined"
    :aria-multiselectable="multiSelectMode || undefined"
  >
    <div v-if="errorMessage" class="list-error" role="alert">
      <span class="i-carbon-warning" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>

    <div ref="scrollAreaRef" class="h-full overflow-y-auto" tabindex="-1">
      <div ref="filterControlsRef" class="relative px-2 pb-3">
        <ClipboardListHeader
          :summary-text="summaryText"
          :is-loading="isLoading"
          :active-filter-label="activeFilterLabel"
          :has-active-filter="filterState.hasActiveFilter.value"
          :has-items="hasItems"
          :multi-select-mode="multiSelectMode"
          :multi-selected-count="multiSelectedCount"
          @toggle-filter="toggleFilterPanel"
          @refresh="handleRefresh"
          @toggle-multi-select="handleToggleMultiSelectMode"
        />

        <div v-if="multiSelectMode" class="multi-select-toolbar">
          <span class="toolbar-summary">已选择 {{ multiSelectedCount }} 项</span>
          <div class="toolbar-actions">
            <button
              class="toolbar-button danger"
              type="button"
              :disabled="!multiSelectedCount || bulkDeletePending"
              @click="handleBulkDeleteSelected"
            >
              <span class="i-carbon-trash-can" aria-hidden="true" />
              {{ bulkDeletePending ? '删除中…' : '删除所选' }}
            </button>
            <button
              class="toolbar-button"
              type="button"
              :disabled="!multiSelectedCount || bulkFavoritePending"
              @click="handleBulkFavoriteSelected"
            >
              <span class="i-carbon-star" aria-hidden="true" />
              {{ bulkFavoritePending ? '处理中…' : '批量收藏' }}
            </button>
          </div>
        </div>

        <ClipboardListFilterPanel
          v-if="filterState.isPanelOpen.value"
          :items="filterState.filterMenuItems.value"
          :selected="filterState.selectedFilter.value"
          @select="handleFilterChange"
        />
      </div>

      <template v-if="hasItems">
        <ClipboardSection
          v-for="section in groupedSections"
          :key="section.key"
          :title="section.title"
          :count="section.items.length"
          :collapse-disabled="section.items.length >= 100"
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
            @apply="handleApply"
            @toggle-multi-select="handleToggleMultiSelectItem"
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
  border: 1px solid var(--clipboard-border-strong);
  background: var(--clipboard-color-danger-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 14%, transparent);
  color: var(--clipboard-color-danger-strong, #b91c1c);
  box-shadow: var(--clipboard-shadow-ghost);
  font-size: 0.82rem;
}

.multi-select-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-strong);
  color: var(--clipboard-text-secondary);
}

.multi-select-toolbar .toolbar-summary {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--clipboard-text-secondary);
}

.multi-select-toolbar .toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.multi-select-toolbar .toolbar-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-base);
  color: var(--clipboard-text-secondary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.multi-select-toolbar .toolbar-button:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 12%, transparent);
}

.multi-select-toolbar .toolbar-button.danger {
  color: var(--clipboard-color-danger, #ef4444);
  border-color: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 36%, transparent);
}

.multi-select-toolbar .toolbar-button.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 12%, transparent);
  border-color: var(--clipboard-color-danger, #ef4444);
  color: var(--clipboard-color-danger, #ef4444);
}

.multi-select-toolbar .toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>

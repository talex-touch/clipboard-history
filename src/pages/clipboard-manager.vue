<script setup lang="ts">
import ClipboardList from '~/components/ClipboardList.vue'
import ClipboardPreview from '~/components/ClipboardPreview.vue'
import FullscreenLoadingOverlay from '~/components/FullscreenLoadingOverlay.vue'
import PageHolder from '~/components/PageHolder.vue'
import { useClipboardManager } from '~/composables/useClipboardManager'

defineOptions({
  name: 'ClipboardManagerPage',
})

const clipboardManager = useClipboardManager()

const {
  clipboardItems,
  selectedItem,
  selectedKey,
  isLoading,
  isLoadingMore,
  favoritePending,
  deletePending,
  applyPending,
  copyPending,
  total,
  pageSize,
  canLoadMore,
  multiSelectMode,
  multiSelectedKeys,
  multiSelectedCount,
  bulkDeletePending,
  bulkFavoritePending,
  refreshHistory,
  loadMore,
  toggleFavorite,
  deleteSelected,
  toggleMultiSelectMode,
  toggleMultiSelectItem,
  bulkDeleteSelected,
  bulkFavoriteSelected,
  selectItem,
  applyItem,
  copyItem,
  formatTimestamp,
} = clipboardManager
</script>

<template>
  <div class="ClipboardManagerPage" :class="{ 'is-loading': isLoading }">
    <PageHolder class="manager-holder" :class="{ blurred: isLoading }">
      <template #aside>
        <ClipboardList
          :items="clipboardItems"
          :selected-key="selectedKey"
          :total="total"
          :page-size="pageSize"
          :is-loading="isLoading"
          :is-loading-more="isLoadingMore"
          :can-load-more="canLoadMore"
          :multi-select-mode="multiSelectMode"
          :multi-selected-keys="multiSelectedKeys"
          :multi-selected-count="multiSelectedCount"
          :bulk-delete-pending="bulkDeletePending"
          :bulk-favorite-pending="bulkFavoritePending"
          v-on="{
            select: selectItem,
            refresh: refreshHistory,
            loadMore,
            toggleMultiSelectMode,
            toggleMultiSelectItem,
            bulkDeleteSelected,
            bulkFavoriteSelected,
          }"
        />
      </template>

      <template #main>
        <ClipboardPreview
          :item="selectedItem"
          :favorite-pending="favoritePending"
          :delete-pending="deletePending"
          :apply-pending="applyPending"
          :copy-pending="copyPending"
          :format-timestamp="formatTimestamp"
          v-on="{
            toggleFavorite,
            delete: deleteSelected,
            copy: () => copyItem(),
            apply: () => applyItem(),
          }"
        />
      </template>
    </PageHolder>
    <FullscreenLoadingOverlay v-if="isLoading" />
  </div>
</template>

<route lang="yaml">
meta:
  layout: default
</route>

<style scoped>
.ClipboardManagerPage {
  position: relative;
  height: 100%;
}

.ClipboardManagerPage .manager-holder {
  transition: filter 0.24s ease;
}

.ClipboardManagerPage .manager-holder.blurred {
  filter: blur(10px);
  pointer-events: none;
}
</style>

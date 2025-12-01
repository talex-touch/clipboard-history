<script setup lang="ts">
import ClipboardList from '~/components/ClipboardList.vue'
import ClipboardPreview from '~/components/ClipboardPreview.vue'
import FullscreenLoadingOverlay from '~/components/FullscreenLoadingOverlay.vue'
import PageHolder from '~/components/PageHolder.vue'
import { useClipboardManager } from '~/composables/useClipboardManager'

defineOptions({
  name: 'ClipboardManagerPage',
})

const manager = useClipboardManager()
</script>

<template>
  <div class="ClipboardManagerPage" :class="{ 'is-loading': manager?.isLoading.value }">
    <PageHolder v-if="manager" class="manager-holder" :class="{ blurred: manager.isLoading.value }">
      <template #aside>
        <ClipboardList
          :items="manager.clipboardItems.value"
          :selected-key="manager.selectedKey.value"
          :total="manager.total.value"
          :page-size="manager.pageSize.value"
          :is-loading="manager.isLoading.value"
          :is-loading-more="manager.isLoadingMore.value"
          :can-load-more="manager.canLoadMore.value"
          :multi-select-mode="manager.multiSelectMode.value"
          :multi-selected-keys="manager.multiSelectedKeys.value"
          :multi-selected-count="manager.multiSelectedCount.value"
          :bulk-delete-pending="manager.bulkDeletePending.value"
          :bulk-favorite-pending="manager.bulkFavoritePending.value"
          v-on="{
            select: manager.selectItem,
            refresh: manager.refreshHistory,
            loadMore: manager.loadMore,
            toggleMultiSelectMode: manager.toggleMultiSelectMode,
            toggleMultiSelectItem: manager.toggleMultiSelectItem,
            bulkDeleteSelected: manager.bulkDeleteSelected,
            bulkFavoriteSelected: manager.bulkFavoriteSelected,
          }"
        />
      </template>

      <template #main>
        <ClipboardPreview
          :item="manager.selectedItem.value"
          :favorite-pending="manager.favoritePending.value"
          :delete-pending="manager.deletePending.value"
          :apply-pending="manager.applyPending.value"
          :copy-pending="manager.copyPending.value"
          :format-timestamp="manager.formatTimestamp"
          v-on="{
            toggleFavorite: manager.toggleFavorite,
            delete: manager.deleteSelected,
            copy: () => manager.copyItem(),
            apply: () => manager.applyItem(),
          }"
        />
      </template>
    </PageHolder>
    <FullscreenLoadingOverlay v-if="manager?.isLoading.value" />
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

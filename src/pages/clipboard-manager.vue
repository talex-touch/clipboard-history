<script setup lang="ts">
import ClipboardActionBar from '~/components/ClipboardActionBar.vue'
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
  <div class="ClipboardManagerPage" :class="{ 'is-loading': manager?.isLoading }">
    <PageHolder v-if="manager" class="manager-holder" :class="{ blurred: manager.isLoading }">
      <template #aside>
        <ClipboardList
          :items="manager.clipboardItems"
          :selected-key="manager.selectedKey"
          :total="manager.total"
          :page-size="manager.pageSize"
          :is-loading="manager.isLoading"
          :is-loading-more="manager.isLoadingMore"
          :can-load-more="manager.canLoadMore"
          :multi-select-mode="manager.multiSelectMode"
          :multi-selected-keys="manager.multiSelectedKeys"
          :multi-selected-count="manager.multiSelectedCount"
          :bulk-delete-pending="manager.bulkDeletePending"
          :bulk-favorite-pending="manager.bulkFavoritePending"
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
          :item="manager.selectedItem"
          :format-timestamp="manager.formatTimestamp"
        />
      </template>

      <template #footer>
        <div class="ManagerFooterBar">
          <div id="clipboard-footer-left" class="footer-left" />
          <ClipboardActionBar
            class="footer-right"
            :item="manager.selectedItem"
            :copy-pending="manager.copyPending"
            :apply-pending="manager.applyPending"
            :favorite-pending="manager.favoritePending"
            :delete-pending="manager.deletePending"
            @copy="manager.copyItem()"
            @apply="manager.applyItem()"
            @toggle-favorite="manager.toggleFavorite()"
            @delete="manager.deleteSelected()"
          />
        </div>
      </template>
    </PageHolder>
    <FullscreenLoadingOverlay v-if="manager?.isLoading" />
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

.ManagerFooterBar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  flex-wrap: nowrap;
}

.footer-left {
  flex: 1 1 auto;
  min-width: 0;
}

.footer-right {
  flex: 0 0 auto;
}
</style>

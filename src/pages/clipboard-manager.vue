<script setup lang="ts">
import ClipboardList from '~/components/ClipboardList.vue'
import ClipboardPreview from '~/components/ClipboardPreview.vue'
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
  isClearing,
  favoritePending,
  deletePending,
  errorMessage,
  total,
  pageSize,
  canLoadMore,
  refreshHistory,
  loadMore,
  toggleFavorite,
  deleteSelected,
  clearHistory,
  selectItem,
  formatTimestamp,
} = clipboardManager
</script>

<template>
  <PageHolder>
    <template #aside>
      <ClipboardList
        :items="clipboardItems"
        :selected-key="selectedKey"
        :total="total"
        :page-size="pageSize"
        :is-loading="isLoading"
        :is-loading-more="isLoadingMore"
        :is-clearing="isClearing"
        :can-load-more="canLoadMore"
        :error-message="errorMessage"
        :format-timestamp="formatTimestamp"
        v-on="{
          select: selectItem,
          refresh: refreshHistory,
          clear: clearHistory,
          loadMore,
        }"
      />
    </template>

    <template #main>
      <ClipboardPreview
        :item="selectedItem"
        :favorite-pending="favoritePending"
        :delete-pending="deletePending"
        :format-timestamp="formatTimestamp"
        v-on="{
          toggleFavorite,
          delete: deleteSelected,
        }"
      />
    </template>
  </PageHolder>
</template>

<route lang="yaml">
meta:
  layout: default
</route>

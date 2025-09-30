<script setup lang="ts">
defineProps<{
  summaryText: string
  isLoading: boolean
  activeFilterLabel: string
  hasActiveFilter: boolean
}>()

const emit = defineEmits<{
  (event: 'toggleFilter'): void
}>()

function handleToggleFilter() {
  emit('toggleFilter')
}
</script>

<template>
  <header class="flex items-center justify-between gap-2 text-sm">
    <div class="header-title">
      <p class="text-slate-700 font-medium dark:text-slate-300">
        {{ summaryText }}
      </p>
    </div>
    <div class="inline-flex items-center gap-2">
      <button
        class="inline-flex cursor-pointer items-center gap-1 border border-slate-300/70 rounded-full bg-slate-50/70 px-2.5 py-1 text-xs text-slate-600 font-semibold transition dark:(border-slate-600/70 bg-slate-800/70 text-slate-300) hover:(border-indigo-400/80 bg-white) dark:hover:(border-indigo-500/80 bg-slate-800)"
        :class="{
          'bg-indigo-500/10 !border-indigo-500/60 text-indigo-600 dark:text-indigo-400': hasActiveFilter,
        }"
        type="button"
        @click="handleToggleFilter"
      >
        <span class="i-carbon-filter text-sm" aria-hidden="true" />
        {{ activeFilterLabel }}
      </button>
      <div v-if="isLoading" class="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <span class="h-3 w-3 animate-spin border-2 border-slate-300 border-t-indigo-500 rounded-full dark:border-slate-600 dark:border-t-indigo-500" aria-hidden="true" />
        正在同步…
      </div>
    </div>
  </header>
</template>

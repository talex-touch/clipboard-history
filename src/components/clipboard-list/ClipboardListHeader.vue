<script setup lang="ts">
const props = defineProps<{
  summaryText: string
  isLoading: boolean
  activeFilterLabel: string
  hasActiveFilter: boolean
  isClearing: boolean
  hasItems: boolean
}>()

const emit = defineEmits<{
  (event: 'toggleFilter'): void
  (event: 'refresh'): void
  (event: 'clear'): void
}>()

function handleToggleFilter() {
  emit('toggleFilter')
}
function handleRefresh() {
  if (!props.isLoading)
    emit('refresh')
}

function handleClear() {
  if (!props.isClearing && props.hasItems)
    emit('clear')
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
      <button
        class="rounded-full p-1.5 text-slate-500 transition disabled:(cursor-not-allowed opacity-60) hover:(bg-slate-200/60 text-slate-700) dark:(text-slate-400) dark:hover:(bg-slate-700/60 text-slate-200)"
        type="button"
        :disabled="isLoading"
        @click="handleRefresh"
      >
        <span class="i-carbon-renew block" aria-hidden="true" />
      </button>
      <button
        class="rounded-full p-1.5 text-red-500/80 transition disabled:(cursor-not-allowed opacity-60) hover:(bg-red-500/10 text-red-500) dark:(text-red-500/90) dark:hover:(bg-red-500/20 text-red-400)"
        type="button"
        :disabled="isClearing || !hasItems"
        @click="handleClear"
      >
        <span class="i-carbon-trash-can block" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

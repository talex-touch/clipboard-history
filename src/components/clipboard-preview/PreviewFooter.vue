<script setup lang="ts">
import PreviewMetaRow from './PreviewMetaRow.vue'

/**
 * PreviewFooter - Footer component for clipboard preview
 * @description Displays meta information in a vertical layout matching the reference design
 */
export interface InfoRow {
  label: string
  value: string
  icon: string
}

defineProps<{
  /** Array of info rows to display */
  rows: InfoRow[]
  /** Optional link href */
  linkHref?: string
}>()
</script>

<template>
  <footer class="flex flex-col">
    <!-- Header -->
    <div class="border-b border-[var(--clipboard-border-color)] py-2">
      <span class="text-3.5 text-[var(--clipboard-text-muted)]">Information</span>
    </div>

    <!-- Meta rows -->
    <PreviewMetaRow
      v-for="row in rows"
      :key="row.label"
      :label="row.label"
      :value="row.value"
    />

    <!-- Link row -->
    <a
      v-if="linkHref"
      class="flex items-center justify-between border-b border-[var(--clipboard-border-color)] py-2 no-underline hover:underline"
      :href="linkHref"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="text-3.3 text-[var(--clipboard-text-muted)]">打开链接</span>
      <span class="i-carbon-launch text-3.3 text-[var(--clipboard-color-accent-strong,var(--clipboard-color-accent,#6366f1))]" aria-hidden="true" />
    </a>
  </footer>
</template>

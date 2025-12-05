<script setup lang="ts">
/**
 * PreviewFiles - File list preview component
 * @description Displays a list of file paths with links
 */
export interface FileItem {
  original: string
  display: string
  href: string
}

defineProps<{
  /** List of file items to display */
  files: FileItem[]
  /** Fallback display text when no files parsed */
  fallbackDisplay?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-3">
    <ul v-if="files.length" class="m-0 flex flex-col list-none gap-2.5 p-0">
      <li
        v-for="(file, index) in files"
        :key="index"
        class="flex items-center gap-2.5 border border-[color-mix(in_srgb,var(--clipboard-border-color)_70%,transparent)] rounded-2.5 border-dashed bg-[var(--clipboard-surface-ghost)] px-3 py-2.5 text-[var(--clipboard-text-secondary)]"
      >
        <span class="i-carbon-document" aria-hidden="true" />
        <a
          class="break-all text-[var(--clipboard-color-accent-strong,var(--clipboard-color-accent,#6366f1))] no-underline hover:underline"
          :href="file.href"
        >
          {{ file.display }}
        </a>
      </li>
    </ul>
    <pre
      v-if="!files.length && fallbackDisplay"
      class="m-0 whitespace-pre-wrap break-all border border-[var(--clipboard-border-color)] rounded-2.5 bg-[var(--clipboard-surface-subtle)] p-3 text-3.5 text-[var(--clipboard-text-primary)]"
    >{{ fallbackDisplay }}</pre>
  </div>
</template>

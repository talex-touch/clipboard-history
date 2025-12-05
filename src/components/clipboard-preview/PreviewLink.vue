<script setup lang="ts">
/**
 * PreviewLink - Link preview component
 * @description Displays URL, email, or phone links with optional secondary text
 */
defineProps<{
  /** Primary display text */
  primaryText: string
  /** Optional secondary description */
  secondaryText?: string
  /** Optional href for making it clickable */
  href?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <p class="m-0 break-all font-600">
      <a
        v-if="href"
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        class="text-[var(--clipboard-color-accent-strong,var(--clipboard-color-accent,#6366f1))]"
      >
        {{ primaryText }}
      </a>
      <span v-else>{{ primaryText }}</span>
    </p>
    <p v-if="secondaryText" class="m-0 text-[var(--clipboard-text-muted)]">
      {{ secondaryText }}
    </p>
  </div>
</template>

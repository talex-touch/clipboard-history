<script setup lang="ts">
/**
 * PreviewColor - Color preview component
 * @description Displays a color swatch with color value details
 */
defineProps<{
  /** The primary color value text */
  primaryText: string
  /** Optional secondary color description */
  secondaryText?: string
  /** CSS color value for the swatch */
  colorSwatch?: string
}>()
</script>

<template>
  <div class="flex flex-row items-center gap-5">
    <div
      class="h-30 w-30 border border-[var(--clipboard-border-color)] rounded-3"
      :style="{ background: colorSwatch || primaryText }"
      aria-hidden="true"
    />
    <div class="flex flex-col gap-2">
      <p class="m-0 text-5 text-[var(--clipboard-text-primary)] font-600">
        {{ primaryText }}
      </p>
      <p v-if="secondaryText" class="m-0 text-[var(--clipboard-text-muted)]">
        {{ secondaryText }}
      </p>
    </div>
  </div>
</template>

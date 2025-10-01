<script setup lang="ts">
defineProps<{
  title: string
  count: number
}>()
</script>

<template>
  <section class="flex flex-col gap-2">
    <header class="section-header p-2">
      <h3>{{ title }} ({{ count }}条)</h3>
    </header>
    <ul class="flex flex-col list-none gap-2 p-2" role="presentation">
      <slot />
    </ul>
  </section>
</template>

<style scoped>
.section-header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--clipboard-surface-subtle);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--clipboard-surface-subtle, rgba(245, 247, 252, 0.92)) 92%, transparent),
    color-mix(in srgb, var(--clipboard-surface-subtle, rgba(245, 247, 252, 0.92)) 78%, transparent)
  );
  backdrop-filter: blur(18px) saturate(180%);
  border-bottom: 1px solid var(--clipboard-border-color);
}

.section-header h3 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--clipboard-text-secondary);
  letter-spacing: 0.02em;
}
</style>

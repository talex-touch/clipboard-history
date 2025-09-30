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
  background: linear-gradient(180deg, rgba(248, 249, 252, 0.92), rgba(248, 249, 252, 0.78));
  backdrop-filter: blur(18px) saturate(180%);
}

.section-header h3 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.02em;
}
</style>

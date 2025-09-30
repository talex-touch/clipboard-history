<script setup lang="ts">
defineProps<{
  title: string
  count: number
}>()
</script>

<template>
  <section class="clipboard-section">
    <header class="section-header">
      <h3>{{ title }} ({{ count }}条)</h3>
    </header>
    <ul class="section-list" role="presentation">
      <slot />
    </ul>
  </section>
</template>

<style scoped>
.clipboard-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 6px 0;
  background: linear-gradient(180deg, rgba(248, 249, 252, 0.92), rgba(248, 249, 252, 0.78));
  backdrop-filter: blur(2px);
}

.section-header h3 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.02em;
}

.section-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>

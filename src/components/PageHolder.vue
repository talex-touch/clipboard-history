<script setup lang="ts">
defineOptions({
  name: 'ClipboardPageHolder',
})
</script>

<template>
  <div class="ClipboardPageHolder fake-background absolute left-0 top-0 h-full w-full flex overflow-hidden">
    <aside class="holder-aside w-[40%]" role="complementary">
      <slot name="aside" />
    </aside>
    <section class="holder-main w-[60%]" role="region">
      <slot name="main" />
    </section>
  </div>
</template>

<style scoped>
.holder-aside,
.holder-main {
  position: relative;
  height: 100%;
  display: flex;
  overflow: hidden;
  flex-direction: column;
}

.ClipboardPageHolder {
  color: var(--clipboard-text-primary);
  background: var(--clipboard-surface-base);
}

.holder-aside {
  border-right: 1px solid var(--clipboard-border-color);
}
</style>

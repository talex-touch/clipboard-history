<script setup lang="ts">
defineOptions({
  name: 'ClipboardPageHolder',
})
</script>

<template>
  <div class="clipboard-page-holder">
    <aside class="holder-aside w-[30%]" role="complementary">
      <slot name="aside" />
    </aside>
    <section class="holder-main w-[70%]" role="region">
      <slot name="main" />
    </section>
  </div>
</template>

<style scoped>
.clipboard-page-holder {
  position: relative;
  inset: 0;
  display: flex;
  min-height: 100%;
  box-sizing: border-box;
}

.holder-aside,
.holder-main {
  position: relative;
  height: 100%;
  display: flex;
  overflow: hidden;
  flex-direction: column;
}
</style>

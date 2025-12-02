<script setup lang="ts">
defineOptions({
  name: 'ClipboardPageHolder',
})
</script>

<template>
  <div class="ClipboardPageHolder fake-background absolute left-0 top-0 h-full w-full flex flex-col overflow-hidden">
    <div class="ClipboardPageHolder-Main flex overflow-hidden">
      <aside class="holder-aside w-[40%]" role="complementary">
        <slot name="aside" />
      </aside>
      <section class="holder-main w-[60%]" role="region">
        <slot name="main" />
      </section>
    </div>

    <section class="ClipboardPageHolder-Footer shrink-0">
      <slot name="footer" />
    </section>
  </div>
</template>

<style lang="scss" scoped>
.ClipboardPageHolder-Footer {
  &::before {
    content: '';
    position: absolute;

    top: 0;
    left: 0;

    width: 100%;
    height: 100%;

    backdrop-filter: blur(18px) saturate(180%);
    background-color: var(--clipboard-color-accent-softer-fallback);
  }
  z-index: 10;
  position: sticky;

  bottom: 0;

  width: 100%;
  height: 48px;
}

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
}

.holder-aside {
  border-right: 1px solid var(--clipboard-border-color);
}
</style>

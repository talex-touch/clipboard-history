<script setup lang="ts">
defineOptions({
  name: 'ClipboardPageHolder',
})
</script>

<template>
  <div class="ClipboardPageHolder fake-background absolute left-0 top-0 h-full w-full flex flex-col overflow-hidden">
    <div class="ClipboardPageHolder-Main flex overflow-hidden">
      <aside class="holder-aside w-[30%]" role="complementary">
        <slot name="aside" />
      </aside>
      <section class="holder-main flex-1" role="region">
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
  position: sticky;
  bottom: 0;
  z-index: 10;
  width: 100%;
  min-height: 54px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: transparent;

  &::before {
    content: '';
    position: absolute;

    top: 0;
    left: 0;

    width: 100%;
    height: 100%;

    backdrop-filter: blur(18px) saturate(180%);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--clipboard-surface-strong) 88%, transparent) 0%,
      color-mix(in srgb, var(--clipboard-surface-ghost) 92%, transparent) 100%
    );
    pointer-events: none;
    z-index: 0;
  }

  :deep(*) {
    position: relative;
    z-index: 1;
  }
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

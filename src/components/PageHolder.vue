<script setup lang="ts">
defineOptions({
  name: 'ClipboardPageHolder',
})
</script>

<template>
  <div class="clipboard-page-holder">
    <div class="holder-shell">
      <aside class="holder-aside" role="complementary">
        <slot name="aside" />
      </aside>
      <section class="holder-main" role="region">
        <slot name="main" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.clipboard-page-holder {
  position: relative;
  inset: 0;
  display: flex;
  padding: 36px;
  min-height: 100%;
  background-color: #f3f5fb;
  background-image:
    radial-gradient(120% 150% at 0% 0%, rgba(99, 102, 241, 0.12), transparent 54%),
    radial-gradient(100% 120% at 100% 0%, rgba(14, 165, 233, 0.08), transparent 62%);
  background-repeat: no-repeat;
  box-sizing: border-box;
}

.holder-shell {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 28px;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 32px;
  padding: 32px;
  backdrop-filter: blur(18px);
  box-shadow:
    0 24px 60px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  overflow: hidden;
}

.holder-aside,
.holder-main {
  position: relative;
  height: 100%;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(248, 249, 252, 0.92), rgba(242, 245, 252, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (max-width: 1024px) {
  .clipboard-page-holder {
    padding: 24px;
  }

  .holder-shell {
    padding: 24px;
    gap: 20px;
    grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
    border-radius: 28px;
  }

  .holder-aside,
  .holder-main {
    border-radius: 22px;
  }
}

@media (max-width: 860px) {
  .clipboard-page-holder {
    padding: 20px;
  }

  .holder-shell {
    grid-template-columns: 1fr;
  }

  .holder-aside,
  .holder-main {
    min-height: 420px;
  }
}
</style>

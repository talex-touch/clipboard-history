<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  count: number
}>()

const sectionRef = ref<HTMLElement | null>(null)

const DOUBLE_TAP_INTERVAL = 320
let lastTouchTimestamp = 0

function scrollToSectionTop() {
  const section = sectionRef.value
  if (!section)
    return

  section.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, [contenteditable="true"]'))
}

function isWithinSectionHeader(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('.section-header'))
}

function handleHeaderDoubleClick(event: MouseEvent) {
  const target = event.target
  if (!isWithinSectionHeader(target) || isInteractiveTarget(target))
    return
  scrollToSectionTop()
}

function handleHeaderTouchEnd(event: TouchEvent) {
  const target = event.target
  if (!isWithinSectionHeader(target)) {
    lastTouchTimestamp = 0
    return
  }

  if (isInteractiveTarget(target))
    return

  const now = performance.now()
  if (now - lastTouchTimestamp < DOUBLE_TAP_INTERVAL) {
    event.preventDefault()
    scrollToSectionTop()
    lastTouchTimestamp = 0
    return
  }

  lastTouchTimestamp = now
}
</script>

<template>
  <section
    ref="sectionRef"
    class="flex flex-col cursor-default select-none"
    role="group"
    @dblclick="handleHeaderDoubleClick"
    @touchend="handleHeaderTouchEnd"
  >
    <header class="section-header flex items-center justify-between gap-2 p-2">
      <h3>{{ title }} ({{ count }}条)</h3>
    </header>
    <ul class="mt-2 flex flex-col list-none gap-2 p-2" role="presentation">
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

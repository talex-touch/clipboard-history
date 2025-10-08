<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    count: number
    collapseDisabled?: boolean
  }>(),
  {
    collapseDisabled: false,
  },
)

const isCollapsed = ref(false)
const sectionRef = ref<HTMLElement | null>(null)

const DOUBLE_TAP_INTERVAL = 320
let lastTouchTimestamp = 0

function toggleCollapse() {
  if (props.collapseDisabled)
    return
  isCollapsed.value = !isCollapsed.value
}

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

watch(
  () => props.collapseDisabled,
  (disabled) => {
    if (disabled)
      isCollapsed.value = false
  },
  { immediate: true },
)

function rememberBoxMetrics(el: HTMLElement) {
  if (el.dataset.collapsePaddingTop && el.dataset.collapsePaddingBottom && el.dataset.collapseMarginTop)
    return

  const style = getComputedStyle(el)
  el.dataset.collapsePaddingTop = style.paddingTop
  el.dataset.collapsePaddingBottom = style.paddingBottom
  el.dataset.collapseMarginTop = style.marginTop
}

function collapseBeforeEnter(el: HTMLElement) {
  rememberBoxMetrics(el)
  el.style.height = '0'
  el.style.opacity = '0'
  el.style.overflow = 'hidden'
  el.style.paddingTop = '0'
  el.style.paddingBottom = '0'
  el.style.marginTop = '0'
}

function collapseEnter(el: HTMLElement) {
  rememberBoxMetrics(el)
  const paddingTop = el.dataset.collapsePaddingTop ?? '0px'
  const paddingBottom = el.dataset.collapsePaddingBottom ?? '0px'
  const marginTop = el.dataset.collapseMarginTop ?? '0px'

  el.style.paddingTop = paddingTop
  el.style.paddingBottom = paddingBottom
  const height = `${el.scrollHeight}px`
  el.style.paddingTop = '0'
  el.style.paddingBottom = '0'
  el.style.marginTop = '0'

  el.style.transition = 'height 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.18s ease-out, margin-top 0.28s cubic-bezier(0.32, 0.72, 0, 1)'
  requestAnimationFrame(() => {
    el.style.height = height
    el.style.opacity = '1'
    el.style.paddingTop = paddingTop
    el.style.paddingBottom = paddingBottom
    el.style.marginTop = marginTop
  })

  el.addEventListener(
    'transitionend',
    (event) => {
      if (event.propertyName !== 'height')
        return
      el.style.height = 'auto'
      el.style.opacity = ''
      el.style.overflow = ''
      el.style.transition = ''
      el.style.paddingTop = ''
      el.style.paddingBottom = ''
      el.style.marginTop = ''
    },
    { once: true },
  )
}

function collapseBeforeLeave(el: HTMLElement) {
  rememberBoxMetrics(el)
  el.style.height = `${el.scrollHeight}px`
  el.style.opacity = '1'
  el.style.overflow = 'hidden'
  el.style.paddingTop = el.dataset.collapsePaddingTop ?? '0px'
  el.style.paddingBottom = el.dataset.collapsePaddingBottom ?? '0px'
  el.style.marginTop = el.dataset.collapseMarginTop ?? '0px'
}

function collapseLeave(el: HTMLElement) {
  // Force reflow so the height transition starts from the current size
  void el.offsetHeight
  el.style.transition = 'height 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.18s ease-out, margin-top 0.28s cubic-bezier(0.32, 0.72, 0, 1)'
  requestAnimationFrame(() => {
    el.style.height = '0'
    el.style.opacity = '0'
    el.style.paddingTop = '0'
    el.style.paddingBottom = '0'
    el.style.marginTop = '0'
  })
  el.addEventListener(
    'transitionend',
    (event) => {
      if (event.propertyName !== 'height')
        return
      el.style.height = ''
      el.style.opacity = ''
      el.style.overflow = ''
      el.style.transition = ''
      el.style.paddingTop = ''
      el.style.paddingBottom = ''
      el.style.marginTop = ''
    },
    { once: true },
  )
}
</script>

<template>
  <section
    ref="sectionRef"
    class="flex flex-col select-none"
    :class="collapseDisabled ? 'cursor-default' : 'cursor-pointer'"
    role="group"
    @dblclick="handleHeaderDoubleClick"
    @touchend="handleHeaderTouchEnd"
  >
    <header class="section-header flex items-center justify-between gap-2 p-2">
      <h3>{{ title }} ({{ count }}条)</h3>
      <button
        v-if="!collapseDisabled"
        class="collapse-toggle h-7 w-7 inline-flex items-center justify-center rounded-full text-base transition-colors duration-200 ease-out"
        type="button"
        :aria-expanded="!isCollapsed"
        :aria-label="`${isCollapsed ? '展开' : '收起'}${title}`"
        :aria-disabled="collapseDisabled || undefined"
        :disabled="collapseDisabled"
        @click="toggleCollapse"
      >
        <span
          class="i-carbon-chevron-up transition-transform duration-200 ease-out"
          :class="{ 'rotate-180': isCollapsed }"
          aria-hidden="true"
        />
      </button>
    </header>
    <Transition
      @before-enter="collapseBeforeEnter"
      @enter="collapseEnter"
      @before-leave="collapseBeforeLeave"
      @leave="collapseLeave"
    >
      <ul
        v-show="!isCollapsed"
        class="mt-2 flex flex-col list-none gap-2 p-2"
        role="presentation"
      >
        <slot />
      </ul>
    </Transition>
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

.collapse-toggle {
  border: 1px solid transparent;
  background: transparent;
  color: var(--clipboard-text-muted);
}

.collapse-toggle:hover,
.collapse-toggle:focus-visible {
  border-color: color-mix(in srgb, var(--clipboard-border-color) 88%, transparent);
  background: color-mix(in srgb, var(--clipboard-surface-strong) 86%, transparent);
  color: var(--clipboard-text-secondary);
}

.collapse-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 16%, transparent);
}

.collapse-toggle span {
  display: block;
}

.collapse-toggle:disabled {
  cursor: default;
  border-color: transparent;
  background: transparent;
  color: color-mix(in srgb, var(--clipboard-text-muted) 64%, transparent);
}
</style>

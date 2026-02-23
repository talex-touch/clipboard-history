<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { resolveCommandValue, useCommandPalette } from '~/composables/useCommandPalette'

defineOptions({
  name: 'CommandPalette',
})

const palette = useCommandPalette()
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)

const hasPalette = computed(() => !!palette)
const isOpen = computed(() => palette?.isOpen.value ?? false)

const rawCommands = computed(() => palette?.commands.value ?? [])

function normalize(value: string) {
  return value.trim().toLowerCase()
}

const filteredCommands = computed(() => {
  const filter = normalize(query.value)
  if (!filter)
    return rawCommands.value

  return rawCommands.value.filter((command) => {
    const title = resolveCommandValue(command.title) ?? ''
    const description = resolveCommandValue(command.description) ?? ''
    const keywords = resolveCommandValue(command.keywords) ?? []
    const haystack = [title, description, ...keywords].join(' ').toLowerCase()
    return haystack.includes(filter)
  })
})

const groupedCommands = computed(() => {
  const groups = new Map<string, typeof filteredCommands.value>()
  const fallbackGroup = '操作'

  for (const command of filteredCommands.value) {
    const groupLabel = resolveCommandValue(command.group) || fallbackGroup
    const bucket = groups.get(groupLabel) ?? []
    bucket.push(command)
    groups.set(groupLabel, bucket)
  }

  return Array.from(groups.entries()).map(([title, commands]) => ({ title, commands }))
})

const flatCommands = computed(() => groupedCommands.value.flatMap(group => group.commands))

function getCommandEnabled(command: (typeof flatCommands.value)[number]) {
  return command.enabled ? command.enabled() : true
}

function close() {
  palette?.close()
}

function executeAt(index: number) {
  const command = flatCommands.value[index]
  if (!command)
    return
  if (!getCommandEnabled(command))
    return

  try {
    command.action()
  }
  finally {
    close()
  }
}

function moveActive(delta: number) {
  const count = flatCommands.value.length
  if (!count)
    return
  const next = (activeIndex.value + delta + count) % count
  activeIndex.value = next
}

watch(isOpen, async (open) => {
  if (open) {
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

watch(filteredCommands, () => {
  activeIndex.value = 0
})

if (typeof document !== 'undefined') {
  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (!isOpen.value)
      return
    if (event.defaultPrevented)
      return

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      executeAt(activeIndex.value)
    }
  })
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget)
    return
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="hasPalette">
      <transition name="fade">
        <div
          v-if="isOpen"
          class="palette-backdrop"
          role="presentation"
          @click="handleBackdropClick"
        >
          <div class="palette-panel" role="dialog" aria-modal="true" aria-label="操作面板">
            <div class="palette-header">
              <span class="i-carbon-search palette-search-icon" aria-hidden="true" />
              <input
                ref="inputRef"
                v-model="query"
                class="palette-input"
                type="text"
                autocomplete="off"
                placeholder="搜索操作…"
              >
              <span class="palette-hint">⌘ K</span>
            </div>

            <div class="palette-body">
              <div v-if="!flatCommands.length" class="palette-empty">
                暂无可用操作
              </div>

              <div v-else class="palette-groups">
                <section
                  v-for="group in groupedCommands"
                  :key="group.title"
                  class="palette-group"
                >
                  <h3 class="palette-group-title">
                    {{ group.title }}
                  </h3>
                  <button
                    v-for="command in group.commands"
                    :key="command.id"
                    class="palette-item"
                    :class="{
                      active: flatCommands[activeIndex]?.id === command.id,
                      danger: resolveCommandValue(command.danger),
                      disabled: !getCommandEnabled(command),
                    }"
                    type="button"
                    :disabled="!getCommandEnabled(command)"
                    @click="executeAt(flatCommands.findIndex(item => item.id === command.id))"
                    @mousemove="activeIndex = flatCommands.findIndex(item => item.id === command.id)"
                  >
                    <span class="palette-item-left">
                      <span
                        v-if="resolveCommandValue(command.icon)"
                        class="palette-item-icon"
                        :class="resolveCommandValue(command.icon)"
                        aria-hidden="true"
                      />
                      <span class="palette-item-text">
                        <span class="palette-item-title">{{ resolveCommandValue(command.title) }}</span>
                        <span v-if="resolveCommandValue(command.description)" class="palette-item-desc">
                          {{ resolveCommandValue(command.description) }}
                        </span>
                      </span>
                    </span>
                    <span v-if="resolveCommandValue(command.shortcut)" class="palette-item-shortcut">
                      {{ resolveCommandValue(command.shortcut) }}
                    </span>
                  </button>
                </section>
              </div>
            </div>

            <div class="palette-footer">
              <span class="palette-footer-tip">↑↓ 选择</span>
              <span class="palette-footer-tip">Enter 执行</span>
              <span class="palette-footer-tip">Esc 关闭</span>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 10vh 12px 12px;
  background: color-mix(in srgb, #0b1220 36%, transparent);
  backdrop-filter: blur(16px) saturate(180%);
}

.palette-panel {
  width: min(680px, 100%);
  border-radius: 18px;
  border: 1px solid var(--clipboard-border-color);
  background: color-mix(in srgb, var(--clipboard-surface-elevated) 92%, transparent);
  box-shadow: var(--clipboard-shadow-strong);
  overflow: hidden;
}

.palette-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--clipboard-border-color) 60%, transparent);
  background: color-mix(in srgb, var(--clipboard-surface-strong) 85%, transparent);
}

.palette-search-icon {
  font-size: 1.05rem;
  color: var(--clipboard-text-muted);
}

.palette-input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--clipboard-text-primary);
  font-size: 0.92rem;
  font-weight: 600;
}

.palette-input::placeholder {
  color: var(--clipboard-text-muted);
  font-weight: 500;
}

.palette-hint {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--clipboard-border-color) 70%, transparent);
  background: color-mix(in srgb, var(--clipboard-surface-base) 92%, transparent);
  color: var(--clipboard-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
}

.palette-body {
  max-height: min(54vh, 420px);
  overflow: auto;
  padding: 10px 10px 12px;
}

.palette-empty {
  padding: 20px 12px;
  color: var(--clipboard-text-muted);
  font-size: 0.86rem;
  text-align: center;
}

.palette-group + .palette-group {
  margin-top: 12px;
}

.palette-group-title {
  margin: 0;
  padding: 8px 12px 6px;
  color: var(--clipboard-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.palette-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--clipboard-text-secondary);
  cursor: pointer;
  transition: all 0.16s ease;
  text-align: left;
}

.palette-item-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.palette-item-icon {
  font-size: 1.05rem;
  color: inherit;
  flex: 0 0 auto;
}

.palette-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.palette-item-title {
  font-size: 0.88rem;
  font-weight: 650;
  color: var(--clipboard-text-primary);
}

.palette-item-desc {
  font-size: 0.78rem;
  color: var(--clipboard-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-item-shortcut {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--clipboard-border-color) 60%, transparent);
  background: color-mix(in srgb, var(--clipboard-surface-ghost) 88%, transparent);
  color: var(--clipboard-text-muted);
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.1;
}

.palette-item.active {
  border-color: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 70%, transparent);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 12%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.palette-item.active .palette-item-title {
  color: inherit;
}

.palette-item.danger {
  color: var(--clipboard-color-danger, #ef4444);
}

.palette-item.danger.active {
  border-color: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 50%, transparent);
  background: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 12%, transparent);
  color: var(--clipboard-color-danger, #ef4444);
}

.palette-item.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.palette-item:hover:not(.disabled):not(.active) {
  border-color: color-mix(in srgb, var(--clipboard-border-color) 70%, transparent);
  background: color-mix(in srgb, var(--clipboard-surface-ghost) 86%, transparent);
}

.palette-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 10px 14px 12px;
  border-top: 1px solid color-mix(in srgb, var(--clipboard-border-color) 60%, transparent);
  background: color-mix(in srgb, var(--clipboard-surface-strong) 82%, transparent);
}

.palette-footer-tip {
  color: var(--clipboard-text-muted);
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1;
}
</style>

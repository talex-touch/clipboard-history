<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed } from 'vue'
import { getItemKey } from '~/composables/useClipboardManager'

const props = defineProps<{
  item: PluginClipboardItem
  index: number
  isActive: boolean
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
}>()

const typeIconMap: Record<string, string> = {
  text: 'i-carbon-text-align-left',
  image: 'i-carbon-image',
  html: 'i-carbon-code',
  richtext: 'i-carbon-text-style',
  files: 'i-carbon-document',
  file: 'i-carbon-document',
  url: 'i-carbon-link',
  application: 'i-carbon-application-web',
}

const itemKey = computed(() => getItemKey(props.item))
const iconClass = computed(() => resolveTypeIcon(props.item.type))

function resolveTypeIcon(type?: PluginClipboardItem['type']) {
  if (!type)
    return 'i-carbon-clipboard'
  return typeIconMap[type] ?? 'i-carbon-clipboard'
}

function handleSelect() {
  emit('select', props.item)
}
</script>

<template>
  <li
    :id="`clipboard-item-${itemKey}`"
    :data-item-id="itemKey"
    role="option"
    :aria-selected="isActive"
    class="ClipboardItem grid grid-cols-[auto_1fr] cursor-pointer items-center gap-2 rounded-2xl px-2 py-2 transition-all duration-180 ease"
    :class="{ active: isActive }"
    @click="handleSelect"
  >
    <div
      class="item-icon h-4 w-4 flex items-center justify-center rounded-xl text-lg transition-colors"
      :class="[iconClass]"
      aria-hidden="true"
    />
    <div class="min-w-0 flex flex-col gap-1.5">
      <p
        class="item-title truncate font-semibold"
        :title="item.content || '（无内容）'"
      >
        {{ item.content || '（无内容）' }}
      </p>
    </div>
  </li>
</template>

<style scoped>
.ClipboardItem {
  border: 1px solid transparent;
  background: transparent;
  &.active {
    border-color: var(--clipboard-border-strong);
    background: var(--clipboard-color-accent-soft-fallback);
    background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 14%, transparent);
  }

  &:hover {
    border-color: var(--clipboard-border-color);
    background: var(--clipboard-surface-strong);
  }

  &:focus-visible {
    outline: 2px solid var(--clipboard-color-accent, #6366f1);
    outline-offset: 2px;
  }
}

.ClipboardItem .item-icon {
  color: var(--clipboard-text-muted);
}

.ClipboardItem.active .item-icon {
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.ClipboardItem .item-title {
  color: var(--clipboard-text-primary);
}

.ClipboardItem.active .item-title {
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}
</style>

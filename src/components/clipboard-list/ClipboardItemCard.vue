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
    class="ClipboardItem grid grid-cols-[auto_1fr] cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-180 ease"
    :class="{ active: isActive }"
    @click="handleSelect"
  >
    <div
      class="h-4 w-4 flex items-center justify-center rounded-xl text-lg transition-colors"
      :class="[iconClass]"
      aria-hidden="true"
    />
    <div class="min-w-0 flex flex-col gap-1.5">
      <p
        class="truncate font-semibold"
        :class="isActive ? 'text-indigo-900' : 'text-slate-800'"
        :title="item.content || '（无内容）'"
      >
        {{ item.content || '（无内容）' }}
      </p>
    </div>
  </li>
</template>

<style scoped>
.ClipboardItem {
  &.active {
    background-color: var(--tuff-bg-color);
  }

  &:hover {
    background-color: var(--tuff-bg-color);
  }
}
</style>

<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed } from 'vue'
import { useClipboardContentInfo } from '~/composables/useClipboardContentInfo'
import { getItemKey } from '~/composables/useClipboardManager'

const props = defineProps<{
  item: PluginClipboardItem
  index: number
  isActive: boolean
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
  (event: 'apply', item: PluginClipboardItem): void
}>()

const itemKey = computed(() => getItemKey(props.item))
const itemInfo = useClipboardContentInfo(
  () => props.item.content,
  {
    baseType: () => props.item.type,
    rawContent: () => props.item.rawContent,
    maxPreviewLength: 80,
  },
)

const iconClass = computed(() => itemInfo.value.icon)
const previewText = computed(() => itemInfo.value.previewText)
const colorSwatch = computed(() => itemInfo.value.colorSwatch)

function handleSelect() {
  emit('select', props.item)
  emit('apply', props.item)
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
    <div class="item-icon h-7 w-7 flex items-center justify-center rounded-xl text-lg transition-colors" aria-hidden="true">
      <span :class="iconClass" class="icon" />
      <span v-if="colorSwatch" class="color-chip" :style="{ background: colorSwatch }" />
    </div>
    <div class="item-body min-w-0 flex flex-col gap-1">
      <p class="item-preview truncate text-sm" :title="previewText">
        {{ previewText }}
      </p>
    </div>
  </li>
</template>

<style scoped>
.ClipboardItem {
  border: 1px solid transparent;
  background: transparent;

  &:hover {
    cursor: pointer;
    /* border-color: var(--clipboard-border-color); */
    background: var(--clipboard-surface-strong);
  }

  &.active,
  &.active:hover {
    border-color: var(--clipboard-border-strong);
    background: var(--clipboard-color-accent-soft-fallback);
    background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 14%, transparent);
  }

  &:focus-visible {
    outline: 2px solid var(--clipboard-color-accent, #6366f1);
    outline-offset: 2px;
  }
}

.ClipboardItem .item-icon {
  color: var(--clipboard-text-muted);
  position: relative;
}

.ClipboardItem.active .item-icon {
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.ClipboardItem .item-icon .icon {
  display: inline-flex;
  width: 1.2em;
  height: 1.2em;
}

.ClipboardItem .item-icon .color-chip {
  position: absolute;

  top: 50%;
  left: 50%;

  width: 12px;
  height: 12px;

  border-radius: 999px;
  transform: translate(-50%, -50%);
  border: 2px solid var(--clipboard-surface-strong);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--clipboard-text-muted) 24%, transparent);
}

.ClipboardItem .item-preview {
  color: var(--clipboard-text-primary);
}

.ClipboardItem.active .item-preview {
  color: var(--clipboard-text-primary, var(--clipboard-color-accent, #6366f1));
}

.ClipboardItem .item-preview {
  color: var(--clipboard-text-muted);
}
</style>

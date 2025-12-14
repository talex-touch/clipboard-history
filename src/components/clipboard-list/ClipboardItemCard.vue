<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { useIntersectionObserver } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { getItemKey } from '~/composables/clipboardUtils'
import { useClipboardContentInfo } from '~/composables/useClipboardContentInfo'

const props = defineProps<{
  item: PluginClipboardItem
  index: number
  isActive: boolean
  isMultiSelectMode: boolean
  isMultiSelected: boolean
}>()

const emit = defineEmits<{
  (event: 'select', item: PluginClipboardItem): void
  (event: 'toggleMultiSelect', item: PluginClipboardItem): void
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

const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.avif', '.svg']

function parseFileList(value: unknown): string[] {
  if (!value)
    return []

  if (Array.isArray(value))
    return value.map(entry => String(entry).trim()).filter(Boolean)

  if (typeof value !== 'string')
    return []

  const trimmed = value.trim()
  if (!trimmed)
    return []

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed))
        return parsed.map(entry => String(entry).trim()).filter(Boolean)
    }
    catch {
      // ignore JSON parsing errors
    }
  }

  return trimmed.split(/[\n;]+/).map(entry => entry.trim()).filter(Boolean)
}

function isImageFile(path: string): boolean {
  const value = path.trim().toLowerCase()
  if (!value)
    return false

  if (value.startsWith('data:image/'))
    return true

  const match = value.match(/\.([a-z0-9]+)(?:\?.*)?$/)
  if (!match)
    return false
  return imageExtensions.includes(`.${match[1]}`)
}

function toTFileUrl(path: string): string | null {
  const trimmed = path.trim()
  if (!trimmed)
    return null

  if (trimmed.startsWith('tfile://'))
    return trimmed

  if (trimmed.startsWith('data:'))
    return trimmed

  const withoutScheme = trimmed.replace(/^file:\/\//i, '')
  const isWindows = /^[a-z]:\\/i.test(withoutScheme)
  const normalised = isWindows ? withoutScheme.replace(/\\/g, '/') : withoutScheme
  const encoded = encodeURI(normalised).replace(/#/g, '%23')
  const prefix = encoded.startsWith('/') || isWindows ? 'tfile:///' : 'tfile://'
  return `${prefix}${encoded.startsWith('/') ? encoded.slice(1) : encoded}`
}

function resolveFilePreviewSrc(item: PluginClipboardItem): string | null {
  if (!['files', 'file', 'image'].includes(item.type))
    return null

  const candidates: string[] = []

  candidates.push(...parseFileList(item.rawContent))
  candidates.push(...parseFileList(item.content))

  const winner = candidates.find(candidate => isImageFile(candidate))
  if (!winner)
    return null

  return toTFileUrl(winner)
}

const previewImage = computed(() => {
  const item = props.item
  if (!item)
    return null

  if (item.thumbnail)
    return item.thumbnail

  if (item.type === 'image') {
    if (typeof item.content === 'string' && item.content.startsWith('data:'))
      return item.content
    const tfileUrl = toTFileUrl(item.content)
    if (tfileUrl)
      return tfileUrl
  }

  if (itemInfo.value.type === 'data-url-image')
    return item.content

  if (['file-path', 'file-uri'].includes(itemInfo.value.type)) {
    const candidate = itemInfo.value.href ?? itemInfo.value.previewText
    if (candidate && isImageFile(candidate)) {
      const tfileUrl = toTFileUrl(candidate)
      if (tfileUrl)
        return tfileUrl
    }
  }

  return resolveFilePreviewSrc(item)
})

function handleClick() {
  if (props.isMultiSelectMode) {
    emit('toggleMultiSelect', props.item)
    return
  }
  emit('select', props.item)
}

// Progressive image loading
const cardRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const imageLoaded = ref(false)
const imageError = ref(false)

// Use intersection observer for lazy loading
useIntersectionObserver(
  cardRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting && !isVisible.value) {
      isVisible.value = true
    }
  },
  {
    rootMargin: '100px',
    threshold: 0.1,
  },
)

function handleImageLoad() {
  imageLoaded.value = true
}

function handleImageError() {
  imageError.value = true
}

const shouldShowImage = computed(() => isVisible.value && previewImage.value && !imageError.value)

// Reset image loading state when item changes
watch(() => props.item.id, () => {
  imageLoaded.value = false
  imageError.value = false
})
</script>

<template>
  <li
    :id="`clipboard-item-${itemKey}`"
    ref="cardRef"
    :data-item-id="itemKey"
    role="option"
    :aria-selected="isActive"
    :aria-checked="isMultiSelectMode ? isMultiSelected : undefined"
    class="ClipboardItem grid grid-cols-[auto_1fr] cursor-pointer items-center gap-2 rounded-2xl px-2 py-2 transition-all duration-180 ease"
    :class="{ 'active': isActive, 'multi-mode': isMultiSelectMode, 'multi-selected': isMultiSelected }"
    @click="handleClick"
  >
    <div
      class="item-icon h-7 w-7 flex items-center justify-center rounded-xl text-lg transition-colors"
      :class="{ 'has-image': shouldShowImage && imageLoaded }"
      aria-hidden="true"
    >
      <!-- Progressive image loading with skeleton -->
      <template v-if="shouldShowImage">
        <div v-if="!imageLoaded" class="image-skeleton" />
        <img
          :src="previewImage!"
          alt=""
          draggable="false"
          :class="{ 'image-loading': !imageLoaded }"
          @load="handleImageLoad"
          @error="handleImageError"
        >
      </template>
      <span v-else-if="!previewImage || imageError" :class="iconClass" class="icon" />
      <span v-if="(!shouldShowImage || imageError) && colorSwatch" class="color-chip" :style="{ background: colorSwatch }" />
    </div>
    <div class="item-body min-w-0 flex flex-col gap-1">
      <p class="item-preview truncate text-sm" :title="previewText">
        {{ previewText }}
      </p>
    </div>
    <div v-if="isMultiSelectMode" class="item-selector" aria-hidden="true">
      <span class="selector" :class="{ selected: isMultiSelected }">
        <span v-if="isMultiSelected" class="i-carbon-checkmark" aria-hidden="true" />
      </span>
    </div>
  </li>
</template>

<style scoped>
.ClipboardItem {
  border: 1px solid transparent;
  background: transparent;
  grid-template-columns: auto 1fr;

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

.ClipboardItem.multi-mode {
  grid-template-columns: auto 1fr auto;
}

.ClipboardItem .item-icon {
  color: var(--clipboard-text-muted);
  position: relative;
}

.ClipboardItem.active .item-icon {
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.ClipboardItem .item-icon.has-image {
  padding: 0;
  background: var(--clipboard-surface-strong);
  overflow: hidden;
}

.ClipboardItem .item-icon.has-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.ClipboardItem .item-icon .image-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--clipboard-surface-strong) 25%,
    var(--clipboard-surface-ghost) 50%,
    var(--clipboard-surface-strong) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: inherit;
}

.ClipboardItem .item-icon img.image-loading {
  opacity: 0;
  position: absolute;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
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

.ClipboardItem.multi-mode .item-selector {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ClipboardItem .selector {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-base);
  color: transparent;
  transition: all 0.18s ease;
}

.ClipboardItem .selector.selected {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 18%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.ClipboardItem.multi-mode.multi-selected {
  border-color: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 24%, transparent);
}
</style>

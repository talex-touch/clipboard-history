<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { getActiveAppSnapshot } from '@talex-touch/utils/plugin/sdk'
import { computed, onMounted, ref } from 'vue'
import { useCommandPalette } from '~/composables/useCommandPalette'

const props = defineProps<{
  item: PluginClipboardItem | null
  applyPending: boolean
  favoritePending: boolean
  deletePending: boolean
}>()

const emit = defineEmits<{
  (event: 'apply'): void
  (event: 'toggleFavorite'): void
  (event: 'delete'): void
}>()

const activeAppName = ref('当前应用')

const pasteTargetName = computed(() => activeAppName.value.trim() || '当前应用')
const pasteButtonLabel = computed(() => props.applyPending ? `粘贴到${pasteTargetName.value}中…` : `粘贴到${pasteTargetName.value}`)
const favoriteButtonLabel = computed(() => {
  if (props.favoritePending)
    return '更新收藏状态…'
  return props.item?.isFavorite ? '取消收藏' : '设为收藏'
})
const deleteButtonLabel = computed(() => (props.deletePending ? '删除中…' : '删除'))

const isFavorite = computed(() => !!props.item?.isFavorite)
const hasItem = computed(() => !!props.item)
const hasPersistedItem = computed(() => !!props.item?.id)
const palette = useCommandPalette()

function handleApply() {
  emit('apply')
}

function handleToggleFavorite() {
  emit('toggleFavorite')
}

function handleDelete() {
  emit('delete')
}

if (palette) {
  palette.register({
    id: 'clipboard.item.paste',
    group: '当前条目',
    title: () => pasteButtonLabel.value,
    description: () => `目标：${pasteTargetName.value}`,
    icon: () => (props.applyPending ? 'i-carbon-time' : 'i-carbon-paste'),
    shortcut: 'Enter',
    enabled: () => hasItem.value && !props.applyPending,
    action: handleApply,
  })

  palette.register({
    id: 'clipboard.item.favorite',
    group: '当前条目',
    title: () => favoriteButtonLabel.value,
    description: () => (hasPersistedItem.value ? '切换收藏状态' : '当前条目不可收藏'),
    icon: () => (isFavorite.value ? 'i-carbon-star-filled' : 'i-carbon-star'),
    enabled: () => hasPersistedItem.value && !props.favoritePending,
    action: handleToggleFavorite,
  })

  palette.register({
    id: 'clipboard.item.delete',
    group: '当前条目',
    title: () => deleteButtonLabel.value,
    description: () => (hasPersistedItem.value ? '删除当前条目' : '当前条目不可删除'),
    icon: () => (props.deletePending ? 'i-carbon-time' : 'i-carbon-delete'),
    danger: true,
    enabled: () => hasPersistedItem.value && !props.deletePending,
    action: handleDelete,
  })
}

onMounted(async () => {
  try {
    const snapshot = await getActiveAppSnapshot().catch(() => null)
    const candidates = [snapshot?.displayName, snapshot?.windowTitle, snapshot?.identifier]
    const resolved = candidates.find(name => typeof name === 'string' && name.trim().length)
    if (resolved)
      activeAppName.value = resolved.trim()
  }
  catch {
    // 忽略插件通道异常，别瞎报错
  }
})
</script>

<template>
  <div class="clipboard-action-bar">
    <div class="footer-actions">
      <button
        class="surface-button primary with-shortcut"
        type="button"
        :disabled="applyPending || !hasItem"
        :title="pasteButtonLabel"
        :aria-label="pasteButtonLabel"
        @click="handleApply"
      >
        <span class="button-icon" :class="applyPending ? 'i-carbon-time' : 'i-carbon-paste'" aria-hidden="true" />
        <span class="button-text">{{ applyPending ? '粘贴中…' : '回车粘贴到当前应用' }}</span>
        <span class="button-shortcut">Enter</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.clipboard-action-bar {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: auto;
  flex: 0 0 auto;
  white-space: nowrap;
}

.footer-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: flex-end;
  flex: 0 0 auto;
  white-space: nowrap;
}

.surface-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--clipboard-border-color) 60%, transparent);
  background: color-mix(in srgb, var(--clipboard-surface-strong) 90%, transparent);
  color: var(--clipboard-text-primary);
  cursor: pointer;
  font-size: 0.86rem;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.surface-button .button-icon {
  font-size: 1rem;
}

.surface-button .button-text {
  font-size: 0.82rem;
  font-weight: 600;
}

.surface-button.with-shortcut {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  padding: 6px 12px;
  white-space: nowrap;
}

.surface-button .button-shortcut {
  margin-left: 4px;
  font-size: 0.78rem;
  color: var(--clipboard-text-secondary);
  line-height: 1;
}

.surface-button.primary {
  border-color: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 70%, transparent);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 12%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.surface-button:hover:not(:disabled) {
  background: color-mix(in srgb, currentColor 10%, transparent);
  border-color: color-mix(in srgb, currentColor 45%, var(--clipboard-border-color));
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}

.surface-button.primary:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.surface-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .clipboard-action-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .footer-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>

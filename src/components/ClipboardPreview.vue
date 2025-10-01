<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { computed } from 'vue'

const props = defineProps<{
  item: PluginClipboardItem | null
  favoritePending: boolean
  deletePending: boolean
  formatTimestamp: (timestamp: PluginClipboardItem['timestamp']) => string
}>()

const emit = defineEmits<{
  (event: 'toggleFavorite'): void
  (event: 'delete'): void
}>()

interface InfoRow {
  label: string
  value: string
  icon: string
}

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

const currentIcon = computed(() => {
  if (!props.item?.type)
    return 'i-carbon-clipboard'
  return typeIconMap[props.item.type] ?? 'i-carbon-clipboard'
})

const typeLabel = computed(() => {
  const type = props.item?.type
  if (!type)
    return '未知类型'
  switch (type) {
    case 'text':
      return '文本'
    case 'image':
      return '图片'
    case 'files':
    case 'file':
      return '文件'
    case 'html':
      return 'HTML'
    case 'richtext':
      return '富文本'
    case 'url':
      return '链接'
    case 'application':
      return '应用数据'
    default:
      return type
  }
})

const timestampText = computed(() => props.item ? props.formatTimestamp(props.item.timestamp) : '')

const infoRows = computed(() => {
  if (!props.item)
    return []

  const rows: InfoRow[] = [
    { label: '类型', value: typeLabel.value, icon: 'i-carbon-tag' },
    { label: '记录时间', value: timestampText.value, icon: 'i-carbon-time' },
  ]

  if (props.item.isFavorite)
    rows.push({ label: '收藏状态', value: '已收藏', icon: 'i-carbon-star-filled' })
  if (props.item.sourceApp)
    rows.push({ label: '来源应用', value: props.item.sourceApp, icon: 'i-carbon-application' })
  if (props.item.id !== undefined && props.item.id !== null)
    rows.push({ label: '标识符', value: String(props.item.id), icon: 'i-carbon-hash' })

  return rows
})

const fileList = computed(() => {
  if (!props.item)
    return []
  const raw = props.item.rawContent
  if (Array.isArray(raw))
    return raw.map(String)
  if (typeof raw === 'string')
    return raw.split(/\n|;/).map(line => line.trim()).filter(Boolean)
  return []
})

const previewText = computed(() => props.item?.content ?? '')

function handleToggleFavorite() {
  emit('toggleFavorite')
}

function handleDelete() {
  emit('delete')
}
</script>

<template>
  <div class="clipboard-preview">
    <header class="preview-header">
      <div class="header-main">
        <div class="type-pill" aria-hidden="true">
          <span :class="currentIcon" />
        </div>
        <div class="title-block">
          <h2>{{ item ? '剪贴内容预览' : '选择一个项目预览' }}</h2>
          <p v-if="item" class="subtitle">
            <span class="i-carbon-time" aria-hidden="true" />
            {{ timestampText }}
          </p>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="action-button"
          type="button"
          :disabled="favoritePending || !item?.id"
          @click="handleToggleFavorite"
        >
          <span :class="item?.isFavorite ? 'i-carbon-star-filled' : 'i-carbon-star'" aria-hidden="true" />
          {{
            favoritePending
              ? '更新中…'
              : item?.isFavorite
                ? '取消收藏'
                : '设为收藏'
          }}
        </button>
        <button
          class="action-button danger"
          type="button"
          :disabled="deletePending || !item?.id"
          @click="handleDelete"
        >
          <span class="i-carbon-delete" aria-hidden="true" />
          {{ deletePending ? '删除中…' : '删除' }}
        </button>
      </div>
    </header>

    <div class="preview-surface">
      <div v-if="!item" class="preview-empty">
        <div class="empty-icon" aria-hidden="true">
          <span class="i-carbon-arrow-up-right" aria-hidden="true" />
        </div>
        <p>在左侧选择一个剪贴记录以查看详情</p>
      </div>
      <template v-else>
        <div v-if="item.type === 'text' || item.type === 'html' || item.type === 'richtext'" class="preview-block text">
          <pre>{{ previewText }}</pre>
        </div>
        <div v-else-if="item.type === 'image'" class="preview-block image">
          <img :src="item.thumbnail || item.content" alt="剪贴图片预览">
        </div>
        <div v-else-if="item.type === 'files' || item.type === 'file'" class="preview-block files">
          <ul>
            <li v-for="(file, index) in fileList" :key="index">
              <span class="i-carbon-document" aria-hidden="true" />
              {{ file }}
            </li>
          </ul>
          <pre v-if="!fileList.length">{{ item.rawContent ?? item.content }}</pre>
        </div>
        <div v-else class="preview-block text">
          <pre>{{ previewText }}</pre>
        </div>
      </template>
    </div>

    <dl v-if="item" class="preview-info">
      <div v-for="row in infoRows" :key="row.label" class="info-row">
        <dt>
          <span :class="row.icon" aria-hidden="true" />
          {{ row.label }}
        </dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.clipboard-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 28px 26px 22px;
  gap: 22px;
  box-sizing: border-box;
  color: var(--clipboard-text-primary);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.type-pill {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: var(--clipboard-color-accent-soft-fallback);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 24%, transparent),
    color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 38%, transparent)
  );
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 40%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  font-size: 1.6rem;
}

.type-pill > span {
  font-size: 1.6rem;
}

.title-block h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--clipboard-text-primary);
}

.subtitle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--clipboard-text-muted);
}

.subtitle span[aria-hidden='true'] {
  color: inherit;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--clipboard-border-color);
  background: var(--clipboard-surface-subtle);
  color: var(--clipboard-text-secondary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.action-button:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-color-accent-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 14%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  box-shadow: var(--clipboard-shadow-ghost);
}

.action-button.danger {
  color: var(--clipboard-color-danger, #ef4444);
  border-color: rgba(239, 68, 68, 0.35);
  border-color: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 35%, transparent);
}

.action-button.danger:hover:not(:disabled) {
  border-color: var(--clipboard-color-danger, #ef4444);
  background: var(--clipboard-color-danger-soft-fallback);
  background: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 16%, transparent);
  box-shadow: var(--clipboard-shadow-ghost);
}

.action-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  color: var(--clipboard-text-disabled);
  border-color: rgba(148, 163, 184, 0.26);
  border-color: color-mix(in srgb, var(--clipboard-border-color, rgba(148, 163, 184, 0.24)) 60%, transparent);
}

.preview-surface {
  position: relative;
  flex: 1;
  border-radius: 22px;
  background: var(--clipboard-surface-elevated);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--clipboard-surface-elevated, rgba(255, 255, 255, 0.96)) 96%, transparent),
    color-mix(in srgb, var(--clipboard-surface-subtle, rgba(245, 247, 252, 0.92)) 92%, transparent)
  );
  border: 1px solid var(--clipboard-border-color);
  padding: 24px;
  overflow-y: auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 65%, transparent);
}

.preview-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--clipboard-text-muted);
}

.preview-empty .empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--clipboard-surface-ghost);
  background: linear-gradient(
    150deg,
    color-mix(in srgb, var(--clipboard-surface-ghost, rgba(148, 163, 184, 0.16)) 65%, transparent),
    color-mix(in srgb, var(--clipboard-surface-ghost, rgba(148, 163, 184, 0.16)) 92%, transparent)
  );
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--clipboard-text-muted);
  font-size: 1.6rem;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-block.text pre {
  margin: 0;
  padding: 16px;
  border-radius: 16px;
  background: var(--clipboard-surface-strong);
  border: 1px solid var(--clipboard-border-color);
  color: var(--clipboard-text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.preview-block.image {
  align-items: center;
}

.preview-block.image img {
  max-width: 100%;
  border-radius: 20px;
  box-shadow: var(--clipboard-shadow-strong);
}

.preview-block.files ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-block.files li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--clipboard-surface-ghost);
  border: 1px solid var(--clipboard-border-color);
  color: var(--clipboard-text-secondary);
}

.preview-block.files pre {
  margin: 0;
  padding: 14px;
  border-radius: 14px;
  background: var(--clipboard-surface-strong);
  border: 1px solid var(--clipboard-border-color);
  color: var(--clipboard-text-primary);
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 18px;
  background: var(--clipboard-surface-ghost);
  border: 1px solid var(--clipboard-border-color);
  color: var(--clipboard-text-primary);
}

.info-row dt {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clipboard-text-muted);
}

.info-row dd {
  margin: 0;
  font-weight: 600;
  word-break: break-word;
}

.preview-surface::-webkit-scrollbar {
  width: 6px;
}

.preview-surface::-webkit-scrollbar-thumb {
  background: var(--clipboard-border-strong);
  background: color-mix(in srgb, var(--clipboard-border-strong, rgba(148, 163, 184, 0.45)) 96%, transparent);
  border-radius: 999px;
}

.preview-surface::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 1024px) {
  .clipboard-preview {
    padding: 22px 20px 18px;
  }

  .preview-surface {
    border-radius: 20px;
  }
}

@media (max-width: 860px) {
  .preview-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    align-self: stretch;
  }

  .action-button {
    flex: 1;
    justify-content: center;
  }
}
</style>

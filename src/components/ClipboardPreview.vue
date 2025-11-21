<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import type { ClipboardDerivedType } from '~/composables/useClipboardContentInfo'
import { getActiveAppSnapshot } from '@talex-touch/utils/plugin/sdk'
import { computed, onMounted, ref, watch } from 'vue'
import { useClipboardContentInfo } from '~/composables/useClipboardContentInfo'
import { ensureTFileUrl } from '~/utils/tfile'

const props = defineProps<{
  item: PluginClipboardItem | null
  favoritePending: boolean
  deletePending: boolean
  applyPending: boolean
  copyPending: boolean
  formatTimestamp: (timestamp: PluginClipboardItem['timestamp']) => string
}>()

const emit = defineEmits<{
  (event: 'toggleFavorite'): void
  (event: 'delete'): void
  (event: 'copy'): void
  (event: 'apply'): void
  (event: 'flow'): void
}>()

interface InfoRow {
  label: string
  value: string
  icon: string
}

type SegmentationCategory = 'sms' | 'number' | 'word'

interface SegmentationToken {
  key: string
  value: string
  category: SegmentationCategory
}

interface SegmentationGroup {
  label: string
  category: SegmentationCategory
  tokens: SegmentationToken[]
}

const SEGMENTATION_MAX_LENGTH = 360
const SMS_CODE_REGEX = /^\d{4,8}$/
const NUMBER_REGEX = /^[-+]?\d+(?:\.\d+)?$/
const WORD_ALLOWED_TYPES = new Set<ClipboardDerivedType>(['text', 'verification-code'])

function addUnique(target: string[], seen: Set<string>, value: string, key: string) {
  if (key && !seen.has(key)) {
    seen.add(key)
    target.push(value)
  }
}

function normaliseDigits(value: string): string {
  return value.replace(/[\uFF10-\uFF19]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 65248))
}

function segmentTextContent(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed)
    return []

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'word' })
      const segments: string[] = []
      for (const part of segmenter.segment(trimmed)) {
        const token = part.segment.trim()
        if (token && (part.isWordLike ?? true))
          segments.push(token)
      }
      if (segments.length)
        return segments
    }
    catch {
      // fall back to regex-based splitting
    }
  }

  return trimmed
    .split(/[\s,.;，。！？、"'“”‘’()（）[\]{}<>《》]+/)
    .map(token => token.trim())
    .filter(Boolean)
}

function createTokens(values: string[], category: SegmentationCategory): SegmentationToken[] {
  return values.map((value, index) => ({
    key: `${category}-${index}-${value}`,
    value,
    category,
  }))
}

const contentInfo = useClipboardContentInfo(
  () => props.item?.content ?? '',
  {
    baseType: () => props.item?.type,
    rawContent: () => props.item?.rawContent,
  },
)

const primaryType = computed(() => (props.item?.type ?? '') as string)
const derivedType = computed(() => props.item ? contentInfo.value.type : 'empty')
// const currentIcon = computed(() => (props.item ? contentInfo.value.icon : 'i-carbon-clipboard'))
const typeLabel = computed(() => (props.item ? contentInfo.value.label : '未知类型'))
const colorSwatch = computed(() => (props.item ? contentInfo.value.colorSwatch : undefined))
const hrefValue = computed(() => (props.item ? contentInfo.value.href : undefined))
const previewPrimaryText = computed(() => (props.item ? contentInfo.value.previewText : ''))
const previewSecondaryText = computed(() => (props.item ? contentInfo.value.secondaryText : undefined))

const timestampText = computed(() => props.item ? props.formatTimestamp(props.item.timestamp) : '')

const textSegmentation = computed<SegmentationGroup[] | null>(() => {
  if (!props.item)
    return null

  if (!WORD_ALLOWED_TYPES.has(contentInfo.value.type))
    return null

  const source = typeof props.item.content === 'string' ? props.item.content : ''
  const text = normaliseDigits(source).trim()

  if (!text || text.length > SEGMENTATION_MAX_LENGTH)
    return null

  const tokens = segmentTextContent(text)
  if (!tokens.length)
    return null

  const smsCodes: string[] = []
  const numbers: string[] = []
  const words: string[] = []

  const seenSms = new Set<string>()
  const seenNumbers = new Set<string>()
  const seenWords = new Set<string>()

  for (const rawToken of tokens) {
    const token = rawToken.trim()
    if (!token)
      continue

    const digitsOnly = token.replace(/\D/g, '')
    if (SMS_CODE_REGEX.test(digitsOnly) && /^\d+$/.test(token)) {
      addUnique(smsCodes, seenSms, digitsOnly, digitsOnly)
      continue
    }

    const numberKey = token.replace(/[,，\s]/g, '')
    if (numberKey && NUMBER_REGEX.test(numberKey)) {
      addUnique(numbers, seenNumbers, token, numberKey)
      continue
    }

    const cleaned = token.replace(/[^\p{L}\p{Script=Han}\d]+/gu, '')
    if (!cleaned)
      continue
    if (/^\d+$/.test(cleaned))
      continue
    if (cleaned.length < 2)
      continue

    addUnique(words, seenWords, token, cleaned.toLowerCase())
  }

  if (!smsCodes.length && !numbers.length && !words.length)
    return null

  const groups: SegmentationGroup[] = []

  if (smsCodes.length)
    groups.push({ label: '验证码', category: 'sms', tokens: createTokens(smsCodes, 'sms') })
  if (numbers.length)
    groups.push({ label: '数字', category: 'number', tokens: createTokens(numbers, 'number') })
  if (words.length)
    groups.push({ label: '词语', category: 'word', tokens: createTokens(words, 'word') })

  return groups.length ? groups : null
})

const allSegmentationTokens = computed(() => textSegmentation.value?.flatMap(group => group.tokens) ?? [])
const hasTextSegmentation = computed(() => allSegmentationTokens.value.length > 0)
const selectedTokenKeys = ref<string[]>([])
const selectedTokens = computed(() => {
  const keySet = new Set(selectedTokenKeys.value)
  return allSegmentationTokens.value.filter(token => keySet.has(token.key))
})
const hasSelectedTokens = computed(() => selectedTokens.value.length > 0)

const activeAppName = ref('当前应用')
const pasteTargetName = computed(() => activeAppName.value?.trim() || '当前应用')
const pasteButtonLabel = computed(() => props.applyPending ? `粘贴到${pasteTargetName.value}中…` : `粘贴到${pasteTargetName.value}`)
const copyButtonLabel = computed(() => (props.copyPending ? '复制中…' : '复制'))
const favoriteButtonLabel = computed(() => {
  if (props.favoritePending)
    return '更新收藏状态…'
  return props.item?.isFavorite ? '取消收藏' : '设为收藏'
})
const deleteButtonLabel = computed(() => (props.deletePending ? '删除中…' : '删除'))

const infoRows = computed(() => {
  if (!props.item)
    return []

  const rows: InfoRow[] = [
    { label: '类型', value: typeLabel.value, icon: 'i-carbon-tag' },
    { label: '记录时间', value: timestampText.value, icon: 'i-carbon-time' },
  ]

  if (props.item.sourceApp)
    rows.push({ label: '来源应用', value: props.item.sourceApp, icon: 'i-carbon-application' })
  if (props.item.id !== undefined && props.item.id !== null)
    rows.push({ label: '标识符', value: String(props.item.id), icon: 'i-carbon-hash' })

  if (contentInfo.value.meta.length)
    contentInfo.value.meta.forEach(meta => rows.push({ label: meta.label, value: meta.value, icon: 'i-carbon-information' }))

  return rows
})

function parseFileListFromString(value: string | null | undefined): string[] {
  if (!value)
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
      // ignore JSON parse failure and fall back to delimiter parsing
    }
  }

  return trimmed.split(/[\n;]+/).map(part => part.trim()).filter(Boolean)
}

const fileList = computed(() => {
  if (!props.item)
    return []

  const raw = props.item.rawContent
  if (Array.isArray(raw))
    return raw.map(entry => String(entry).trim()).filter(Boolean)

  const fromRaw = typeof raw === 'string' ? parseFileListFromString(raw) : []
  if (fromRaw.length)
    return fromRaw

  return parseFileListFromString(props.item.content)
})

const formattedFileList = computed(() => fileList.value.map(file => ({
  original: file,
  display: ensureTFileUrl(file),
  href: ensureTFileUrl(file),
})))

const fallbackFileContent = computed(() => {
  if (!props.item)
    return ''
  const raw = props.item.rawContent ?? props.item.content
  if (typeof raw !== 'string')
    return ''

  const lines = raw.split(/\r?\n/)
  const mapped = lines.map(line => line.trim()).filter(Boolean).map(ensureTFileUrl)
  return mapped.length ? mapped.join('\n') : ensureTFileUrl(raw)
})

const fallbackFileDisplay = computed(() => {
  if (fallbackFileContent.value)
    return fallbackFileContent.value
  const source = props.item?.rawContent ?? props.item?.content
  return typeof source === 'string' ? source : ''
})

const previewText = computed(() => props.item?.content ?? '')
const imageSrc = computed(() => {
  if (!props.item)
    return ''
  if (props.item.thumbnail)
    return props.item.thumbnail
  const content = typeof props.item.content === 'string' ? props.item.content : ''
  if (primaryType.value === 'image') {
    if (/^(?:data|https?|blob):/i.test(content))
      return content
    return ensureTFileUrl(content)
  }
  if (contentInfo.value.type === 'data-url-image')
    return content
  if (['file-path', 'file-uri'].includes(contentInfo.value.type)) {
    const candidate = contentInfo.value.href ?? contentInfo.value.previewText
    if (candidate)
      return ensureTFileUrl(candidate)
  }
  return ''
})

const linkHref = computed(() => {
  if (!props.item)
    return undefined
  if (hrefValue.value)
    return hrefValue.value

  if (contentInfo.value.type === 'email')
    return `mailto:${contentInfo.value.previewText}`
  if (contentInfo.value.type === 'phone')
    return `tel:${contentInfo.value.previewText.replace(/\D/g, '')}`
  return undefined
})

function handleToggleFavorite() {
  emit('toggleFavorite')
}

function handleDelete() {
  emit('delete')
}

function handleCopy() {
  emit('copy')
}

function handleApply() {
  emit('apply')
}

function handleFlow() {
  emit('flow')
}

function isTokenSelected(token: SegmentationToken): boolean {
  return selectedTokenKeys.value.includes(token.key)
}

function toggleTokenSelection(token: SegmentationToken) {
  const exists = isTokenSelected(token)
  if (exists)
    selectedTokenKeys.value = selectedTokenKeys.value.filter(key => key !== token.key)
  else
    selectedTokenKeys.value = [...selectedTokenKeys.value, token.key]
}

async function copyTokenValues(tokens: SegmentationToken[]) {
  if (!tokens.length)
    return
  const text = tokens.map(token => token.value).join(' ')
  if (!text)
    return

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  }
  catch (error) {
    console.error('Failed to write tokens to clipboard', error)
  }

  if (typeof document === 'undefined')
    return

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    document.execCommand('copy')
  }
  catch (error) {
    console.error('Fallback copy failed', error)
  }
  finally {
    document.body.removeChild(textarea)
  }
}

const tokenCopyPending = ref(false)

async function handleCopyAllTokens() {
  if (!hasTextSegmentation.value || tokenCopyPending.value)
    return
  tokenCopyPending.value = true
  try {
    await copyTokenValues(allSegmentationTokens.value)
  }
  finally {
    tokenCopyPending.value = false
  }
}

async function handleCopySelectedTokens() {
  if (!hasSelectedTokens.value || tokenCopyPending.value)
    return
  tokenCopyPending.value = true
  try {
    await copyTokenValues(selectedTokens.value)
  }
  finally {
    tokenCopyPending.value = false
  }
}

watch(textSegmentation, () => {
  selectedTokenKeys.value = []
}, { deep: true })

onMounted(async () => {
  try {
    const snapshot = await getActiveAppSnapshot().catch(() => null)
    const candidates = [snapshot?.displayName, snapshot?.windowTitle, snapshot?.identifier]
    const resolved = candidates.find(name => typeof name === 'string' && name.trim().length)
    if (resolved)
      activeAppName.value = resolved.trim()
  }
  catch {
    // ignore channel errors when SDK is unavailable
  }
})
</script>

<template>
  <div class="clipboard-preview">
    <div class="preview-surface" :class="{ 'is-empty': !item }">
      <div v-if="!item" class="preview-empty">
        <div class="empty-icon" aria-hidden="true">
          <span class="i-carbon-arrow-up-right" aria-hidden="true" />
        </div>
        <p>在左侧选择一个剪贴记录以查看详情</p>
      </div>
      <template v-else>
        <div v-if="derivedType === 'color'" class="preview-block color">
          <div class="color-sample" :style="{ background: colorSwatch || previewPrimaryText }" aria-hidden="true" />
          <div class="color-details">
            <p class="color-value">
              {{ previewPrimaryText }}
            </p>
            <p v-if="previewSecondaryText" class="color-secondary">
              {{ previewSecondaryText }}
            </p>
          </div>
        </div>
        <div v-else-if="derivedType === 'data-url-image' || primaryType === 'image'" class="preview-block image">
          <img :src="imageSrc || item.content" alt="剪贴图片预览">
        </div>
        <div v-else-if="['files', 'file'].includes(primaryType) || derivedType === 'file-uri' || derivedType === 'file-path' || derivedType === 'folder-path'" class="preview-block files">
          <ul>
            <li v-for="(file, index) in formattedFileList" :key="index">
              <span class="i-carbon-document" aria-hidden="true" />
              <a class="file-link" :href="file.href">{{ file.display }}</a>
            </li>
          </ul>
          <pre v-if="!formattedFileList.length && fallbackFileDisplay">{{ fallbackFileDisplay }}</pre>
        </div>
        <div v-else-if="derivedType === 'url' || derivedType === 'email' || derivedType === 'email-link' || derivedType === 'phone'" class="preview-block link">
          <p class="link-primary">
            <a
              v-if="linkHref"
              :href="linkHref"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ previewPrimaryText }}
            </a>
            <span v-else>{{ previewPrimaryText }}</span>
          </p>
          <p v-if="previewSecondaryText" class="link-secondary">
            {{ previewSecondaryText }}
          </p>
        </div>
        <div v-else class="preview-block text">
          <pre>{{ previewText }}</pre>
          <div v-if="hasTextSegmentation && textSegmentation" class="text-segmentation">
            <div class="segmentation-actions">
              <button
                type="button"
                class="segmentation-action"
                :disabled="!hasTextSegmentation || tokenCopyPending"
                @click="handleCopyAllTokens"
              >
                复制全部
              </button>
              <button
                type="button"
                class="segmentation-action"
                :disabled="!hasSelectedTokens || tokenCopyPending"
                @click="handleCopySelectedTokens"
              >
                复制选中
              </button>
            </div>
            <div class="segmentation-groups">
              <section
                v-for="group in textSegmentation"
                :key="group.category"
                class="segmentation-group"
              >
                <p class="segmentation-title">
                  {{ group.label }}
                </p>
                <div class="segmentation-chips">
                  <button
                    v-for="token in group.tokens"
                    :key="token.key"
                    type="button"
                    class="segmentation-chip"
                    :class="[
                      `is-${token.category}`,
                      { 'is-selected': isTokenSelected(token) },
                    ]"
                    :aria-pressed="isTokenSelected(token)"
                    @click="toggleTokenSelection(token)"
                  >
                    {{ token.value }}
                  </button>
                </div>
              </section>
            </div>
          </div>
          <p v-if="previewSecondaryText" class="preview-hint">
            {{ previewSecondaryText }}
          </p>
        </div>
      </template>
    </div>

    <footer v-if="item" class="preview-footer">
      <div class="footer-meta">
        <div v-for="row in infoRows" :key="row.label" class="meta-item">
          <span :class="row.icon" aria-hidden="true" />
          <span class="meta-label">{{ row.label }}</span>
          <span class="meta-value">{{ row.value }}</span>
        </div>
        <a
          v-if="linkHref"
          class="meta-item meta-link"
          :href="linkHref"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="i-carbon-launch" aria-hidden="true" />
          打开链接
        </a>
      </div>
      <div class="footer-actions">
        <button
          class="surface-button"
          type="button"
          :disabled="copyPending || !item"
          :title="copyButtonLabel"
          :aria-label="copyButtonLabel"
          @click="handleCopy"
        >
          <span class="button-icon" :class="copyPending ? 'i-carbon-time' : 'i-carbon-copy'" aria-hidden="true" />
          <span class="button-text">{{ copyButtonLabel }}</span>
        </button>
        <button
          class="surface-button primary"
          type="button"
          :disabled="applyPending || !item"
          :title="pasteButtonLabel"
          :aria-label="pasteButtonLabel"
          @click="handleApply"
        >
          <span class="button-icon" :class="applyPending ? 'i-carbon-time' : 'i-carbon-paste'" aria-hidden="true" />
          <span class="button-text">{{ pasteButtonLabel }}</span>
        </button>
        <button
          class="surface-button"
          type="button"
          :disabled="!item"
          title="流转"
          aria-label="流转"
          @click="handleFlow"
        >
          <span class="button-icon i-carbon-repeat" aria-hidden="true" />
          <span class="button-text">流转</span>
        </button>
        <button
          class="surface-button icon-only" :class="[{ 'is-active': item?.isFavorite }]"
          type="button"
          :disabled="favoritePending || !item?.id"
          :title="favoriteButtonLabel"
          :aria-label="favoriteButtonLabel"
          @click="handleToggleFavorite"
        >
          <span class="button-icon" :class="item?.isFavorite ? 'i-carbon-star-filled' : 'i-carbon-star'" aria-hidden="true" />
        </button>
        <button
          class="surface-button danger icon-only"
          type="button"
          :disabled="deletePending || !item?.id"
          :title="deleteButtonLabel"
          :aria-label="deleteButtonLabel"
          @click="handleDelete"
        >
          <span class="button-icon" :class="deletePending ? 'i-carbon-time' : 'i-carbon-delete'" aria-hidden="true" />
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.clipboard-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 22px 20px 18px;
  gap: 18px;
  box-sizing: border-box;
  color: var(--clipboard-text-primary);
}

.preview-surface {
  position: relative;
  flex: 1;
  border-radius: 12px;
  background: var(--clipboard-surface-strong);
  border: 1px solid var(--clipboard-border-color);
  padding: 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.preview-surface.is-empty {
  justify-content: center;
}
.preview-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid var(--clipboard-border-color);
  padding-top: 12px;
}

.footer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.meta-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  text-decoration: none;
}

.meta-link:hover {
  text-decoration: underline;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--clipboard-surface-ghost);
  color: var(--clipboard-text-secondary);
  font-size: 0.82rem;
  max-width: 100%;
}

.meta-item .meta-label {
  font-size: 0.75rem;
  color: var(--clipboard-text-muted);
}

.meta-item .meta-label::after {
  content: '：';
  margin: 0 2px;
  color: inherit;
}

.meta-item .meta-value {
  font-weight: 600;
  color: var(--clipboard-text-primary);
  word-break: break-word;
}

.meta-item.meta-link {
  background: none;
  padding: 0;
  border-radius: 0;
  gap: 4px;
}

.footer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.surface-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--clipboard-border-color);
  background: transparent;
  color: var(--clipboard-text-secondary);
  cursor: pointer;
  font-size: 0.88rem;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.surface-button .button-icon {
  font-size: 1.05rem;
}

.surface-button .button-text {
  font-size: 0.82rem;
  font-weight: 500;
}

.surface-button.icon-only {
  width: 40px;
  min-height: 40px;
  padding: 0;
  border-radius: 50%;
  gap: 0;
}

.surface-button.icon-only .button-text {
  display: none;
}

.surface-button.primary {
  border-color: var(--clipboard-color-accent, #6366f1);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.surface-button:hover:not(:disabled) {
  background: color-mix(in srgb, currentColor 14%, transparent);
  border-color: color-mix(in srgb, currentColor 40%, var(--clipboard-border-color));
}

.surface-button.danger {
  border-color: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 36%, transparent);
  color: var(--clipboard-color-danger, #ef4444);
}

.surface-button.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--clipboard-color-danger, #ef4444) 12%, transparent);
  border-color: var(--clipboard-color-danger, #ef4444);
  color: var(--clipboard-color-danger, #ef4444);
}

.surface-button.primary:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.surface-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.surface-button.is-active {
  border-color: var(--clipboard-color-accent, #6366f1);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.surface-button.is-active:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
}

.preview-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--clipboard-text-muted);
  text-align: center;
}

.preview-empty .empty-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--clipboard-surface-ghost);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--clipboard-text-muted);
  font-size: 1.4rem;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-block.color {
  flex-direction: row;
  align-items: center;
  gap: 20px;
}

.preview-block.color .color-sample {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  border: 1px solid var(--clipboard-border-color);
  box-shadow: none;
}

.preview-block.color .color-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-block.color .color-value {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--clipboard-text-primary);
}

.preview-block.color .color-secondary {
  margin: 0;
  color: var(--clipboard-text-muted);
}

.preview-block.text pre {
  margin: 0;
  padding: 14px;
  border-radius: 10px;
  background: var(--clipboard-surface-ghost);
  border: 1px solid var(--clipboard-border-color);
  color: var(--clipboard-text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  font-size: 0.92rem;
}

.preview-block.text .text-segmentation {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--clipboard-border-color) 55%, transparent);
  background: var(--clipboard-surface-subtle);
}

.text-segmentation .segmentation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.text-segmentation .segmentation-action {
  appearance: none;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--clipboard-border-color) 70%, transparent);
  background: var(--clipboard-surface-ghost);
  color: var(--clipboard-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.text-segmentation .segmentation-action:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.text-segmentation .segmentation-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.text-segmentation .segmentation-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.text-segmentation .segmentation-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-segmentation .segmentation-title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--clipboard-text-muted);
}

.text-segmentation .segmentation-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.text-segmentation .segmentation-chip {
  appearance: none;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--clipboard-surface-ghost);
  border: 1px solid color-mix(in srgb, var(--clipboard-border-color) 70%, transparent);
  color: var(--clipboard-text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.text-segmentation .segmentation-chip.is-number {
  min-width: 40px;
  padding: 6px 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-color: color-mix(in srgb, var(--clipboard-color-success, #22c55e) 65%, transparent);
  color: color-mix(in srgb, var(--clipboard-color-success, #22c55e) 90%, var(--clipboard-text-secondary));
}

.text-segmentation .segmentation-chip.is-sms {
  border-color: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 65%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.text-segmentation .segmentation-chip.is-word {
  color: var(--clipboard-text-primary);
}

.text-segmentation .segmentation-chip.is-selected {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 16%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 30%, transparent);
}

.text-segmentation .segmentation-chip:hover:not(.is-selected) {
  border-color: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 45%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.text-segmentation .segmentation-chip:focus-visible {
  outline: 2px solid var(--clipboard-color-accent, #6366f1);
  outline-offset: 2px;
}

.preview-block.image {
  align-items: center;
}

.preview-block.image img {
  max-width: 100%;
  border-radius: 12px;
  box-shadow: var(--clipboard-shadow-soft, 0 8px 20px rgba(15, 23, 42, 0.12));
}

.preview-block.link {
  gap: 10px;
}

.preview-block.link .link-primary {
  margin: 0;
  font-weight: 600;
  word-break: break-all;
}

.preview-block.link a {
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.preview-block.link .link-secondary {
  margin: 0;
  color: var(--clipboard-text-muted);
}

.preview-block.text .preview-hint {
  margin: 0;
  color: var(--clipboard-text-muted);
  font-size: 0.85rem;
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
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--clipboard-surface-ghost);
  border: 1px dashed color-mix(in srgb, var(--clipboard-border-color) 70%, transparent);
  color: var(--clipboard-text-secondary);
}

.preview-block.files .file-link {
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  text-decoration: none;
  word-break: break-all;
}

.preview-block.files .file-link:hover {
  text-decoration: underline;
}

.preview-block.files pre {
  margin: 0;
  padding: 12px;
  border-radius: 10px;
  background: var(--clipboard-surface-subtle);
  border: 1px solid var(--clipboard-border-color);
  color: var(--clipboard-text-primary);
  font-size: 0.9rem;
  white-space: pre-wrap;
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
    padding: 18px 16px;
  }
}

@media (max-width: 860px) {
  .preview-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .footer-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>

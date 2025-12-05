<script setup lang="ts">
import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import type { ClipboardDerivedType } from '~/composables/useClipboardContentInfo'
import { computed } from 'vue'
import { useClipboardContentInfo } from '~/composables/useClipboardContentInfo'
import { ensureTFileUrl } from '~/utils/tfile'
import {
  PreviewColor,
  PreviewEmpty,
  PreviewFiles,
  PreviewFooter,
  PreviewImage,
  PreviewLink,
  PreviewText,
} from './clipboard-preview'

/**
 * ClipboardPreview - Main preview component for clipboard items
 * @description Displays detailed preview of selected clipboard item with type-specific rendering
 */

const props = defineProps<{
  item: PluginClipboardItem | null
  formatTimestamp: (timestamp: PluginClipboardItem['timestamp']) => string
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
    .split(/[\s,.;，。！？、"'()（）[\]{}<>《》]+/)
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

const infoRows = computed(() => {
  if (!props.item)
    return []

  const rows: InfoRow[] = []

  // 1. 来源应用 (Source)
  if (props.item.sourceApp)
    rows.push({ label: '来源应用', value: props.item.sourceApp, icon: 'i-carbon-application' })

  // 2. 内容类型 (Content type)
  rows.push({ label: '内容类型', value: typeLabel.value, icon: 'i-carbon-tag' })

  // 3. 其他 meta 信息
  if (contentInfo.value.meta.length)
    contentInfo.value.meta.forEach(meta => rows.push({ label: meta.label, value: meta.value, icon: 'i-carbon-information' }))

  // 4. 记录时间
  rows.push({ label: '记录时间', value: timestampText.value, icon: 'i-carbon-time' })

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

const isFileType = computed(() =>
  ['files', 'file'].includes(primaryType.value)
  || derivedType.value === 'file-uri'
  || derivedType.value === 'file-path'
  || derivedType.value === 'folder-path',
)

const isLinkType = computed(() =>
  derivedType.value === 'url'
  || derivedType.value === 'email'
  || derivedType.value === 'email-link'
  || derivedType.value === 'phone',
)
</script>

<template>
  <div class="relative box-border h-full flex flex-col gap-4.5 text-[var(--clipboard-text-primary)]">
    <div
      class="preview-surface relative h-[60%] flex flex-1 flex-col gap-4.5 overflow-y-auto border border-[var(--clipboard-border-color)] bg-[var(--clipboard-surface-strong)] px-2"
      :class="{ 'justify-center': !item }"
    >
      <PreviewEmpty v-if="!item" />
      <template v-else>
        <PreviewColor
          v-if="derivedType === 'color'"
          :primary-text="previewPrimaryText"
          :secondary-text="previewSecondaryText"
          :color-swatch="colorSwatch"
        />
        <PreviewImage
          v-else-if="derivedType === 'data-url-image' || primaryType === 'image'"
          :src="imageSrc || item.content"
        />
        <PreviewFiles
          v-else-if="isFileType"
          :files="formattedFileList"
          :fallback-display="fallbackFileDisplay"
        />
        <PreviewLink
          v-else-if="isLinkType"
          :primary-text="previewPrimaryText"
          :secondary-text="previewSecondaryText"
          :href="linkHref"
        />
        <PreviewText
          v-else
          :text="previewText"
          :secondary-text="previewSecondaryText"
          :segmentation="textSegmentation"
        />
      </template>
    </div>

    <PreviewFooter
      v-if="item"
      :rows="infoRows"
      :link-href="linkHref"
    />
  </div>
</template>

<style scoped>
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
</style>

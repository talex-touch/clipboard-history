import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

export type ClipboardDerivedType
  = | 'empty'
    | 'color'
    | 'data-url-image'
    | 'data-url'
    | 'url'
    | 'email'
    | 'email-link'
    | 'phone'
    | 'ip-address'
    | 'verification-code'
    | 'file-uri'
    | 'file-path'
    | 'folder-path'
    | 'json'
    | 'html'
    | 'code'
    | 'text'

export type ClipboardBaseType
  = | 'text'
    | 'html'
    | 'richtext'
    | 'image'
    | 'file'
    | 'files'
    | 'url'
    | 'application'

export interface ClipboardContentMeta {
  label: string
  value: string
}

export interface ClipboardContentInfo {
  /** 原始内容 */
  content: string
  /** 基础类型（来源于原始数据） */
  baseType?: ClipboardBaseType | string
  /** 解析后的类型 */
  type: ClipboardDerivedType
  /** 类型展示名称 */
  label: string
  /** Iconify 图标类名 */
  icon: string
  /** 列表展示的主预览文本 */
  previewText: string
  /** 列表展示的辅助信息（可选） */
  secondaryText?: string
  /** 用于颜色类型的可视化 */
  colorSwatch?: string
  /** 若内容是链接，返回 href */
  href?: string
  /** 附加元信息 */
  meta: ClipboardContentMeta[]
}

export interface UseClipboardContentInfoOptions {
  /** 原始类型（例如后端返回的 type 字段） */
  baseType?: MaybeRefOrGetter<ClipboardBaseType | string | undefined | null>
  /** 原始内容（例如 rawContent，可用于补充信息） */
  rawContent?: MaybeRefOrGetter<unknown>
  /** 列表展示时截断长度 */
  maxPreviewLength?: number
}

const typeLabelMap: Record<ClipboardDerivedType, string> = {
  'empty': '空内容',
  'color': '颜色',
  'data-url-image': '图片数据',
  'data-url': '数据 URL',
  'url': '链接',
  'email': '邮箱地址',
  'email-link': '邮件链接',
  'phone': '电话号码',
  'ip-address': 'IP 地址',
  'verification-code': '验证码',
  'file-uri': '文件链接',
  'file-path': '文件路径',
  'folder-path': '文件夹路径',
  'json': 'JSON 数据',
  'html': 'HTML',
  'code': '代码片段',
  'text': '文本',
}

const typeIconMap: Record<ClipboardDerivedType, string> = {
  'empty': 'i-carbon-clipboard',
  'color': 'i-carbon-color-palette',
  'data-url-image': 'i-carbon-image',
  'data-url': 'i-carbon-data-view',
  'url': 'i-carbon-link',
  'email': 'i-carbon-email',
  'email-link': 'i-carbon-email',
  'phone': 'i-carbon-phone',
  'ip-address': 'i-carbon-locations',
  'verification-code': 'i-carbon-password',
  'file-uri': 'i-carbon-document',
  'file-path': 'i-carbon-document',
  'folder-path': 'i-carbon-folder',
  'json': 'i-carbon-braces',
  'html': 'i-carbon-code',
  'code': 'i-carbon-code',
  'text': 'i-carbon-text-align-left',
}

const dataUrlRegex = /^data:(?<mime>[\w/+.-]+);base64,(?<data>[a-z0-9+/=\s]+)$/i
const hexColorRegex = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
// eslint-disable-next-line regexp/no-unused-capturing-group
const rgbColorRegex = /^rgba?\(\s*((\d{1,3}%?|\d{1,3}\s*\.\d+%?)\s*,\s*){2}(\d{1,3}%?|\d{1,3}\s*\.\d+%?)(\s*,\s*((?:\d+(?:\.\d+)?|\.\d+)%?))?\s*\)$/i
// eslint-disable-next-line regexp/no-unused-capturing-group
const hslColorRegex = /^hsla?\(\s*\d{1,3}(?:\.\d+)?(?:deg|rad|grad|turn)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*((?:\d+(?:\.\d+)?|\.\d+)%?))?\)$/i
const emailRegex = /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const phoneRegex = /^\+?\d{1,4}[-\s]?(?:\d{2,4}[-\s]?){1,4}\d{2,}$/
const ipRegex = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/
const verificationCodeRegex = /^\d{4,8}$/
const windowsPathRegex = /^[a-z]:\\[^<>:"|?*\r\n]*$/i
// eslint-disable-next-line regexp/no-super-linear-backtracking
const windowsDirectoryRegex = /^[a-z]:\\(?:[^<>:"|?*\r\n]+\\)+$/i
const unixPathRegex = /^\/(?:[^\s/]+\/)*[^\s/]*$/
const unixDirectoryRegex = /^\/(?:[^\s/]+\/)+$/
const tildePathRegex = /^~\/(?:[^\s/]+\/)*[^\s/]*$/
const codeLikeRegex = /[;{}`]/

interface ParsedDataUrl {
  mime: string
  size: number
  isImage: boolean
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0)
    return ''

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  const display = value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${display} ${units[index]}`
}

function truncate(value: string, length: number): string {
  if (value.length <= length)
    return value
  return `${value.slice(0, length - 1)}…`
}

function normaliseHexColor(value: string): string {
  const v = value.trim()
  return v.startsWith('#') ? v.toUpperCase() : `#${v.toUpperCase()}`
}

function parseDataUrl(value: string): ParsedDataUrl | null {
  const match = value.match(dataUrlRegex)
  if (!match || !match.groups)
    return null

  const { mime, data } = match.groups
  const base64 = data.replace(/\s+/g, '')
  const paddingMatch = base64.match(/=+$/)
  const paddingLength = paddingMatch ? paddingMatch[0].length : 0
  const size = Math.floor((base64.length * 3) / 4) - paddingLength
  const isImage = mime.startsWith('image/')

  return {
    mime,
    size,
    isImage,
  }
}

// Only accept common URL protocols to avoid false positives like "border: 1px solid"
const validUrlProtocols = new Set(['http:', 'https:', 'ftp:', 'ftps:', 'file:', 'mailto:', 'tel:', 'ssh:', 'git:'])

function parseUrl(value: string): URL | null {
  // Quick check: must start with a valid protocol pattern
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value))
    return null

  try {
    const url = new URL(value)
    // Only accept known protocols to avoid false positives
    if (!validUrlProtocols.has(url.protocol.toLowerCase()))
      return null
    return url
  }
  catch {
    return null
  }
}

function looksLikeJson(value: string): boolean {
  if (!value)
    return false
  const trimmed = value.trim()
  if (!trimmed)
    return false
  if (!['{', '['].includes(trimmed[0]))
    return false
  try {
    JSON.parse(trimmed)
    return true
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (error) {
    return false
  }
}

function looksLikeHtml(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>'))
    return false
  return /<\w+[\s>]/.test(trimmed)
}

function looksLikeCode(value: string): boolean {
  if (value.includes('\n') && codeLikeRegex.test(value))
    return true
  if (/function\s+\w+/.test(value))
    return true
  if (/\bconst\s+\w+\s*=/.test(value))
    return true
  return false
}

function cleanupPreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function safeParseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string')
    return []

  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']'))
    return []

  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed.map(item => cleanupPreview(String(item))).filter(Boolean) : []
  }
  catch {
    return []
  }
}

const baseTypeIconMap: Record<ClipboardBaseType, string> = {
  text: 'i-carbon-text-align-left',
  html: 'i-carbon-code',
  richtext: 'i-carbon-text-style',
  image: 'i-carbon-image',
  file: 'i-carbon-document',
  files: 'i-carbon-document',
  url: 'i-carbon-link',
  application: 'i-carbon-application-web',
}

const baseTypeLabelMap: Record<ClipboardBaseType, string> = {
  text: '文本',
  html: 'HTML',
  richtext: '富文本',
  image: '图片',
  file: '文件',
  files: '文件',
  url: '链接',
  application: '应用数据',
}

function isClipboardBaseType(value: unknown): value is ClipboardBaseType {
  return typeof value === 'string' && value in baseTypeLabelMap
}

export function useClipboardContentInfo(
  contentSource: MaybeRefOrGetter<string | null | undefined>,
  options: UseClipboardContentInfoOptions = {},
): ComputedRef<ClipboardContentInfo> {
  const maxLength = options.maxPreviewLength ?? 120

  return computed<ClipboardContentInfo>(() => {
    const rawContent = toValue(contentSource)
    const baseType = options.baseType == null ? undefined : toValue(options.baseType)
    const raw = options.rawContent == null ? undefined : toValue(options.rawContent)
    const content = typeof rawContent === 'string' ? rawContent : rawContent ?? ''
    const trimmed = content.trim()

    if (!trimmed) {
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'empty',
        label: typeLabelMap.empty,
        icon: typeIconMap.empty,
        previewText: '（无内容）',
        meta: [],
      }
    }

    const meta: ClipboardContentMeta[] = []

    const knownBaseType = isClipboardBaseType(baseType) ? baseType : undefined
    const allowTextHeuristics = !knownBaseType || knownBaseType === 'text' || knownBaseType === 'richtext'
    const allowUrlHeuristics = allowTextHeuristics || knownBaseType === 'url'
    const allowPathHeuristics = allowTextHeuristics || knownBaseType === 'file' || knownBaseType === 'files'

    if (Array.isArray(raw) && raw.length) {
      const first = cleanupPreview(String(raw[0]))
      const extra = raw.slice(1, 4).map(item => cleanupPreview(String(item))).filter(Boolean)
      const remainder = Math.max(0, raw.length - 4)
      const secondary = extra.length ? `${extra.join(' · ')}${remainder ? ` · 等 ${remainder} 个` : ''}` : undefined

      meta.push({ label: '条目数量', value: String(raw.length) })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'file-path',
        label: typeLabelMap['file-path'],
        icon: typeIconMap['file-path'],
        previewText: first,
        secondaryText: secondary ? truncate(secondary, maxLength) : undefined,
        meta,
      }
    }

    if (knownBaseType === 'files') {
      const candidates: string[] = []

      if (typeof raw === 'string') {
        const parsed = safeParseJsonArray(raw)
        if (parsed.length)
          candidates.push(...parsed)
      }

      if (!candidates.length) {
        const parsed = safeParseJsonArray(content)
        if (parsed.length)
          candidates.push(...parsed)
      }

      if (!candidates.length) {
        const parts = content.split(/[\n;]+/).map(part => cleanupPreview(part)).filter(Boolean)
        candidates.push(...parts)
      }

      if (candidates.length) {
        const first = cleanupPreview(candidates[0])
        const extra = candidates.slice(1, 4).map(item => cleanupPreview(item)).filter(Boolean)
        const remainder = Math.max(0, candidates.length - 4)
        const secondary = extra.length
          ? `${extra.join(' · ')}${remainder ? ` · 等 ${remainder} 个` : ''}`
          : undefined

        meta.push({ label: '条目数量', value: String(candidates.length) })
        return {
          content,
          baseType: baseType ?? undefined,
          type: 'file-path',
          label: typeLabelMap['file-path'],
          icon: typeIconMap['file-path'],
          previewText: first,
          secondaryText: secondary ? truncate(secondary, maxLength) : undefined,
          meta,
        }
      }
    }

    const dataUrl = parseDataUrl(trimmed)
    if (dataUrl) {
      const type: ClipboardDerivedType = dataUrl.isImage ? 'data-url-image' : 'data-url'
      const label = typeLabelMap[type]
      const icon = typeIconMap[type]
      const sizeLabel = formatBytes(dataUrl.size)
      if (sizeLabel)
        meta.push({ label: '大小', value: sizeLabel })
      meta.push({ label: 'MIME', value: dataUrl.mime })

      return {
        content,
        baseType: baseType ?? undefined,
        type,
        label,
        icon,
        previewText: `${dataUrl.mime}${sizeLabel ? ` · ${sizeLabel}` : ''}`,
        secondaryText: truncate(trimmed, maxLength),
        href: trimmed,
        meta,
      }
    }

    if (allowTextHeuristics && (hexColorRegex.test(trimmed) || rgbColorRegex.test(trimmed) || hslColorRegex.test(trimmed))) {
      const normalized = hexColorRegex.test(trimmed) ? normaliseHexColor(trimmed) : trimmed
      meta.push({ label: '颜色值', value: normalized })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'color',
        label: typeLabelMap.color,
        icon: typeIconMap.color,
        previewText: normalized,
        colorSwatch: normalized,
        meta,
      }
    }

    const url = allowUrlHeuristics ? parseUrl(trimmed) : null
    if (url) {
      if (url.protocol === 'file:') {
        const isDirectory = url.pathname.endsWith('/')
        const type: ClipboardDerivedType = isDirectory ? 'folder-path' : 'file-uri'
        if (isDirectory)
          meta.push({ label: '类型', value: '文件夹' })
        meta.push({ label: '路径', value: decodeURIComponent(url.pathname) || '/' })
        return {
          content,
          baseType: baseType ?? undefined,
          type,
          label: typeLabelMap[type],
          icon: typeIconMap[type],
          previewText: decodeURIComponent(url.pathname) || '/',
          href: trimmed,
          meta,
        }
      }

      if (url.protocol === 'mailto:') {
        const address = url.pathname
        if (address)
          meta.push({ label: '收件人', value: address })
        if (url.searchParams.toString())
          meta.push({ label: '参数', value: decodeURIComponent(url.searchParams.toString()) })
        return {
          content,
          baseType: baseType ?? undefined,
          type: 'email-link',
          label: typeLabelMap['email-link'],
          icon: typeIconMap['email-link'],
          previewText: address || trimmed,
          href: trimmed,
          meta,
        }
      }

      const hostname = url.hostname || url.href
      const preview = `${hostname}${url.pathname === '/' ? '' : url.pathname}`
      if (url.search)
        meta.push({ label: '查询参数', value: url.search })
      meta.push({ label: '协议', value: url.protocol.replace(':', '') })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'url',
        label: typeLabelMap.url,
        icon: typeIconMap.url,
        previewText: preview,
        secondaryText: url.href,
        href: url.href,
        meta,
      }
    }

    if (allowTextHeuristics && emailRegex.test(trimmed)) {
      const [, domain] = trimmed.split('@')
      if (domain)
        meta.push({ label: '域名', value: domain })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'email',
        label: typeLabelMap.email,
        icon: typeIconMap.email,
        previewText: trimmed,
        href: `mailto:${trimmed}`,
        meta,
      }
    }

    if (allowTextHeuristics && phoneRegex.test(trimmed)) {
      const digitsOnly = trimmed.replace(/\D/g, '')
      meta.push({ label: '长度', value: String(digitsOnly.length) })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'phone',
        label: typeLabelMap.phone,
        icon: typeIconMap.phone,
        previewText: trimmed,
        href: digitsOnly ? `tel:${digitsOnly}` : undefined,
        meta,
      }
    }

    if (allowTextHeuristics && ipRegex.test(trimmed)) {
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'ip-address',
        label: typeLabelMap['ip-address'],
        icon: typeIconMap['ip-address'],
        previewText: trimmed,
        meta,
      }
    }

    if (allowTextHeuristics && verificationCodeRegex.test(trimmed)) {
      meta.push({ label: '位数', value: String(trimmed.length) })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'verification-code',
        label: typeLabelMap['verification-code'],
        icon: typeIconMap['verification-code'],
        previewText: trimmed,
        meta,
      }
    }

    if (allowPathHeuristics && (windowsDirectoryRegex.test(trimmed) || unixDirectoryRegex.test(trimmed) || trimmed.endsWith('/') || trimmed.endsWith('\\'))) {
      const normalized = trimmed
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'folder-path',
        label: typeLabelMap['folder-path'],
        icon: typeIconMap['folder-path'],
        previewText: normalized,
        meta,
      }
    }

    if (allowPathHeuristics && (windowsPathRegex.test(trimmed) || unixPathRegex.test(trimmed) || tildePathRegex.test(trimmed))) {
      const normalized = trimmed
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'file-path',
        label: typeLabelMap['file-path'],
        icon: typeIconMap['file-path'],
        previewText: normalized,
        meta,
      }
    }

    if (allowTextHeuristics && looksLikeJson(trimmed)) {
      const parsed = JSON.parse(trimmed)
      const size = JSON.stringify(parsed).length
      meta.push({ label: '大小', value: `${size} 字符` })
      const keys = typeof parsed === 'object' && parsed ? Object.keys(parsed) : []
      if (keys.length)
        meta.push({ label: '键数量', value: String(keys.length) })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'json',
        label: typeLabelMap.json,
        icon: typeIconMap.json,
        previewText: truncate(cleanupPreview(trimmed), maxLength),
        meta,
      }
    }

    if (allowTextHeuristics && looksLikeHtml(trimmed)) {
      meta.push({ label: '标签数量', value: String((trimmed.match(/<\w+/g) ?? []).length) })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'html',
        label: typeLabelMap.html,
        icon: typeIconMap.html,
        previewText: truncate(cleanupPreview(trimmed), maxLength),
        meta,
      }
    }

    if (allowTextHeuristics && looksLikeCode(trimmed)) {
      const lines = trimmed.split(/\r?\n/)
      meta.push({ label: '行数', value: String(lines.length) })
      return {
        content,
        baseType: baseType ?? undefined,
        type: 'code',
        label: typeLabelMap.code,
        icon: typeIconMap.code,
        previewText: truncate(cleanupPreview(lines[0] ?? trimmed), maxLength),
        secondaryText: truncate(cleanupPreview(trimmed), maxLength),
        meta,
      }
    }

    const fallbackPreview = truncate(cleanupPreview(trimmed), maxLength)
    if (baseType) {
      if (knownBaseType) {
        return {
          content,
          baseType,
          type: 'text',
          label: baseTypeLabelMap[knownBaseType],
          icon: baseTypeIconMap[knownBaseType],
          previewText: fallbackPreview,
          meta,
        }
      }

      return {
        content,
        baseType,
        type: 'text',
        label: typeLabelMap.text,
        icon: typeIconMap.text,
        previewText: fallbackPreview,
        meta,
      }
    }

    return {
      content,
      baseType: baseType ?? undefined,
      type: 'text',
      label: typeLabelMap.text,
      icon: typeIconMap.text,
      previewText: fallbackPreview,
      meta,
    }
  })
}

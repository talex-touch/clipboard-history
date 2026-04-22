export function ensureTFileUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed)
    return 'tfile://'

  if (/^(?:data|https?|blob):/i.test(trimmed))
    return trimmed

  const rawPath = trimmed
    .replace(/^tfile:(?:\/\/)?/i, '')
    .replace(/^file:(?:\/\/)?/i, '')
  const decodedPath = safeDecodeUri(rawPath)
  const normalizedPath = decodedPath.replace(/\\/g, '/')
  const windowsCandidate = normalizedPath.replace(/^\/+/, '')
  const isWindowsPath = /^[a-z]:\//i.test(windowsCandidate)
  const absolutePath = isWindowsPath
    ? windowsCandidate
    : `/${normalizedPath.replace(/^\/+/, '')}`
  const encoded = encodeURI(absolutePath).replace(/#/g, '%23')

  if (isWindowsPath)
    return `tfile:///${encoded.replace(/^\/+/, '')}`

  if (encoded.startsWith('/'))
    return `tfile:///${encoded.replace(/^\/+/, '')}`

  return `tfile://${encoded}`
}

export function isDataUrl(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith('data:')
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURI(value)
  }
  catch {
    return value
  }
}

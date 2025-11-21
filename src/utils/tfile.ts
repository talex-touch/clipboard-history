export function ensureTFileUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed)
    return 'tfile://'

  if (/^(?:tfile|data|https?|blob):/i.test(trimmed))
    return trimmed

  if (/^file:/i.test(trimmed))
    return trimmed.replace(/^file:/i, 'tfile:')

  const isWindowsPath = /^[a-z]:[\\/]/i.test(trimmed)
  const normalized = (isWindowsPath ? trimmed.replace(/\\/g, '/') : trimmed).replace(/^file:\/\//i, '')
  const encoded = encodeURI(normalized).replace(/#/g, '%23')

  if (isWindowsPath)
    return `tfile:///${encoded.replace(/^\/+/, '')}`

  if (encoded.startsWith('/'))
    return `tfile:///${encoded.replace(/^\/+/, '')}`

  return `tfile://${encoded}`
}

export function isDataUrl(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith('data:')
}

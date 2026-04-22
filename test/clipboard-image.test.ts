import type { PluginClipboardItem } from '@talex-touch/utils/plugin/sdk/types'
import { describe, expect, it } from 'vitest'
import {
  hasClipboardDetailImageSource,
  resolveClipboardDetailImageSource,
  resolveClipboardListImageSource,
} from '~/utils/clipboard-image'
import { ensureTFileUrl } from '~/utils/tfile'

function createImageItem(overrides: Partial<PluginClipboardItem> = {}): PluginClipboardItem {
  return {
    id: 1,
    type: 'image',
    content: 'tfile:///tmp/clipboard/original.png',
    thumbnail: 'data:image/png;base64,thumb',
    rawContent: null,
    sourceApp: null,
    timestamp: Date.now(),
    isFavorite: false,
    metadata: null,
    meta: null,
    ...overrides,
  }
}

describe('clipboard-image source helpers', () => {
  it('详情优先使用原图地址', () => {
    const item = createImageItem({
      meta: {
        image_original_url: 'tfile:///tmp/clipboard/original-hd.png',
        image_preview_url: 'tfile:///tmp/clipboard/preview.png',
        image_content_kind: 'preview',
      },
    })

    expect(resolveClipboardDetailImageSource(item)).toBe('tfile:///tmp/clipboard/original-hd.png')
    expect(hasClipboardDetailImageSource(item)).toBe(true)
  })

  it('原图缺失时详情回退到 preview url，而不是 thumbnail', () => {
    const item = createImageItem({
      content: 'data:image/png;base64,thumb',
      meta: {
        image_preview_url: 'tfile:///tmp/clipboard/preview.png',
        image_content_kind: 'thumbnail',
      },
    })

    expect(resolveClipboardDetailImageSource(item)).toBe('tfile:///tmp/clipboard/preview.png')
    expect(hasClipboardDetailImageSource(item)).toBe(true)
  })

  it('只有 thumbnail 时不把它误判成详情大图源', () => {
    const item = createImageItem({
      content: 'data:image/png;base64,thumb',
      thumbnail: 'data:image/png;base64,thumb',
      meta: {
        image_content_kind: 'thumbnail',
      },
    })

    expect(hasClipboardDetailImageSource(item)).toBe(false)
    expect(resolveClipboardDetailImageSource(item)).toBe('data:image/png;base64,thumb')
  })

  it('列表优先使用 thumbnail，缺失时再用 preview url', () => {
    const withThumbnail = createImageItem({
      meta: {
        image_preview_url: 'tfile:///tmp/clipboard/preview.png',
      },
    })
    const withoutThumbnail = createImageItem({
      thumbnail: null,
      meta: {
        image_preview_url: 'tfile:///tmp/clipboard/preview.png',
      },
    })

    expect(resolveClipboardListImageSource(withThumbnail)).toBe('data:image/png;base64,thumb')
    expect(resolveClipboardListImageSource(withoutThumbnail)).toBe('tfile:///tmp/clipboard/preview.png')
  })

  it('会把错误的 tfile host 形态纠正为 canonical absolute path', () => {
    expect(ensureTFileUrl('tfile://Users/talexdreamsoul/test image.png')).toBe('tfile:///Users/talexdreamsoul/test%20image.png')

    const item = createImageItem({
      meta: {
        image_original_url: 'tfile://Users/talexdreamsoul/Library/Application Support/@talex-touch/core-app/temp/clipboard/images/demo image.png',
      },
    })

    expect(resolveClipboardDetailImageSource(item)).toBe('tfile:///Users/talexdreamsoul/Library/Application%20Support/@talex-touch/core-app/temp/clipboard/images/demo%20image.png')
  })
})

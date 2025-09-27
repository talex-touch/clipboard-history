import { ref } from 'vue'

export interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image'
  timestamp: number
}

export function useClipboard() {
  const clipboardItems = ref<ClipboardItem[]>([
    { id: '1', content: 'Hello, world!', type: 'text', timestamp: Date.now() - 10000 },
    { id: '2', content: 'This is a test.', type: 'text', timestamp: Date.now() - 5000 },
    { id: '3', content: 'https://via.placeholder.com/150', type: 'image', timestamp: Date.now() },
  ])

  return {
    clipboardItems,
  }
}

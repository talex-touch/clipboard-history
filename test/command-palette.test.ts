import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import CommandPalette from '~/components/CommandPalette.vue'
import { useCommandPaletteProvider } from '~/composables/useCommandPalette'

describe('commandPalette', () => {
  it('toggles with Meta+K and closes with Escape', async () => {
    const Host = defineComponent({
      setup() {
        useCommandPaletteProvider()
        return () => h(CommandPalette)
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })

    expect(document.querySelector('.palette-backdrop')).toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    await nextTick()

    expect(document.querySelector('.palette-backdrop')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(document.querySelector('.palette-backdrop')).toBeNull()

    wrapper.unmount()
  })

  it('executes a command and closes', async () => {
    const action = vi.fn()

    const Host = defineComponent({
      setup() {
        const palette = useCommandPaletteProvider()
        palette.register({
          id: 'test.action',
          group: '测试',
          title: '测试操作',
          description: '执行一个回调',
          icon: 'i-carbon-command',
          action,
        })
        return () => h(CommandPalette)
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    await nextTick()

    const button = document.querySelector<HTMLButtonElement>('.palette-item')
    expect(button).not.toBeNull()

    button?.click()
    await nextTick()

    expect(action).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.palette-backdrop')).toBeNull()

    wrapper.unmount()
  })
})

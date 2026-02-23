import type { ComputedRef, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { computed, inject, onScopeDispose, provide, ref } from 'vue'

export type CommandPaletteValueResolver<T> = T | (() => T)

export interface CommandPaletteCommand {
  id: string
  group?: CommandPaletteValueResolver<string | undefined>
  title: CommandPaletteValueResolver<string>
  description?: CommandPaletteValueResolver<string | undefined>
  icon?: CommandPaletteValueResolver<string | undefined>
  shortcut?: CommandPaletteValueResolver<string | undefined>
  danger?: CommandPaletteValueResolver<boolean | undefined>
  keywords?: CommandPaletteValueResolver<string[] | undefined>
  enabled?: () => boolean
  action: () => void
}

export interface CommandPaletteState {
  isOpen: Ref<boolean>
  commands: ComputedRef<CommandPaletteCommand[]>
  open: () => void
  close: () => void
  toggle: () => void
  register: (command: CommandPaletteCommand) => () => void
}

const COMMAND_PALETTE_SYMBOL = Symbol('command-palette')

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element)
    return false
  const tag = element.tagName
  return (
    tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
    || element.isContentEditable
  )
}

export function useCommandPaletteProvider(): CommandPaletteState {
  const isOpen = ref(false)
  const commandList = ref<CommandPaletteCommand[]>([])
  const lastActiveElement = ref<HTMLElement | null>(null)

  function open() {
    if (typeof document !== 'undefined')
      lastActiveElement.value = document.activeElement as HTMLElement | null
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    if (lastActiveElement.value) {
      try {
        lastActiveElement.value.focus()
      }
      catch {
        // ignore focus restore failures
      }
    }
    lastActiveElement.value = null
  }

  function toggle() {
    if (isOpen.value)
      close()
    else
      open()
  }

  function register(command: CommandPaletteCommand) {
    commandList.value = [
      ...commandList.value.filter(item => item.id !== command.id),
      command,
    ]

    const unregister = () => {
      commandList.value = commandList.value.filter(item => item.id !== command.id)
    }

    onScopeDispose(unregister)
    return unregister
  }

  const commands = computed(() => commandList.value)

  provide(COMMAND_PALETTE_SYMBOL, {
    isOpen,
    commands,
    open,
    close,
    toggle,
    register,
  } satisfies CommandPaletteState)

  if (typeof document !== 'undefined') {
    useEventListener(document, 'keydown', (event: KeyboardEvent) => {
      if (event.defaultPrevented)
        return

      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        if (!isOpen.value && isEditableTarget(event.target))
          return
        event.preventDefault()
        toggle()
      }
    })
  }

  return {
    isOpen,
    commands,
    open,
    close,
    toggle,
    register,
  }
}

export function useCommandPalette(): CommandPaletteState | null {
  return inject<CommandPaletteState | null>(COMMAND_PALETTE_SYMBOL, null)
}

export function resolveCommandValue<T>(value: CommandPaletteValueResolver<T> | undefined): T | undefined {
  if (typeof value === 'function')
    return (value as () => T)()
  return value
}

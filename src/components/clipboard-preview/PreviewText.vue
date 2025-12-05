<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * PreviewText - Text preview component with segmentation
 * @description Displays text content with optional word segmentation for verification codes, numbers, and words
 */

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

const props = defineProps<{
  /** Text content to display */
  text: string
  /** Optional secondary hint text */
  secondaryText?: string
  /** Optional segmentation groups */
  segmentation?: SegmentationGroup[] | null
}>()

const allTokens = computed(() => props.segmentation?.flatMap(group => group.tokens) ?? [])
const hasSegmentation = computed(() => allTokens.value.length > 0)
const selectedTokenKeys = ref<string[]>([])
const selectedTokens = computed(() => {
  const keySet = new Set(selectedTokenKeys.value)
  return allTokens.value.filter(token => keySet.has(token.key))
})
const hasSelectedTokens = computed(() => selectedTokens.value.length > 0)

const tokenCopyPending = ref(false)

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

async function handleCopyAllTokens() {
  if (!hasSegmentation.value || tokenCopyPending.value)
    return
  tokenCopyPending.value = true
  try {
    await copyTokenValues(allTokens.value)
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

watch(() => props.segmentation, () => {
  selectedTokenKeys.value = []
}, { deep: true })
</script>

<template>
  <div class="flex flex-col gap-3">
    <pre
      class="m-0 whitespace-pre-wrap break-all p-3.5 text-3.7 text-[var(--clipboard-text-primary)] leading-relaxed font-mono"
    >{{ text }}</pre>

    <div v-if="hasSegmentation && segmentation" class="flex flex-col gap-4 p-4">
      <!-- Actions -->
      <div class="flex justify-end gap-2.5">
        <button
          type="button"
          class="inline-flex cursor-pointer appearance-none items-center justify-center border border-[color-mix(in_srgb,var(--clipboard-border-color)_70%,transparent)] rounded-full border-none bg-[var(--clipboard-surface-ghost)] px-3.5 py-1.5 text-3.2 text-[var(--clipboard-text-secondary)] transition-all duration-160 disabled:cursor-not-allowed disabled:opacity-45 hover:not-disabled:border-[var(--clipboard-color-accent,#6366f1)] hover:not-disabled:text-[var(--clipboard-color-accent-strong,var(--clipboard-color-accent,#6366f1))]"
          :disabled="!hasSegmentation || tokenCopyPending"
          @click="handleCopyAllTokens"
        >
          复制全部
        </button>
        <button
          type="button"
          class="inline-flex cursor-pointer appearance-none items-center justify-center border border-[color-mix(in_srgb,var(--clipboard-border-color)_70%,transparent)] rounded-full border-none bg-[var(--clipboard-surface-ghost)] px-3.5 py-1.5 text-3.2 text-[var(--clipboard-text-secondary)] transition-all duration-160 disabled:cursor-not-allowed disabled:opacity-45 hover:not-disabled:border-[var(--clipboard-color-accent,#6366f1)] hover:not-disabled:text-[var(--clipboard-color-accent-strong,var(--clipboard-color-accent,#6366f1))]"
          :disabled="!hasSelectedTokens || tokenCopyPending"
          @click="handleCopySelectedTokens"
        >
          复制选中
        </button>
      </div>

      <!-- Groups -->
      <div class="flex flex-col gap-3.5">
        <section
          v-for="group in segmentation"
          :key="group.category"
          class="flex flex-col gap-2"
        >
          <p class="m-0 text-3.1 text-[var(--clipboard-text-muted)] font-600">
            {{ group.label }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="token in group.tokens"
              :key="token.key"
              type="button"
              class="segmentation-chip inline-flex cursor-pointer appearance-none items-center justify-center gap-1 border border-[color-mix(in_srgb,var(--clipboard-border-color)_70%,transparent)] rounded-full border-none bg-[var(--clipboard-surface-ghost)] px-3.5 py-1.5 text-3.3 text-[var(--clipboard-text-secondary)] transition-all duration-160"
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

    <p v-if="secondaryText" class="m-0 text-3.4 text-[var(--clipboard-text-muted)]">
      {{ secondaryText }}
    </p>
  </div>
</template>

<style scoped>
.segmentation-chip.is-number {
  min-width: 40px;
  padding: 6px 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-color: color-mix(in srgb, var(--clipboard-color-success, #22c55e) 65%, transparent);
  color: color-mix(in srgb, var(--clipboard-color-success, #22c55e) 90%, var(--clipboard-text-secondary));
}

.segmentation-chip.is-sms {
  border-color: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 65%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.segmentation-chip.is-word {
  color: var(--clipboard-text-primary);
}

.segmentation-chip.is-selected {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 16%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 30%, transparent);
}

.segmentation-chip:hover:not(.is-selected) {
  border-color: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 45%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.segmentation-chip:focus-visible {
  outline: 2px solid var(--clipboard-color-accent, #6366f1);
  outline-offset: 2px;
}
</style>

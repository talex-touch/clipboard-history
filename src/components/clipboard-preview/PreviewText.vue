<script setup lang="ts">
import { computed, ref, shallowRef, watch, watchEffect } from 'vue'

/**
 * PreviewText - Text preview component with segmentation
 * @description Displays text content with optional word segmentation for verification codes, numbers, and words
 * Supports code highlighting and Markdown rendering with toggle buttons
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

type RenderMode = 'plain' | 'code' | 'markdown'

const props = defineProps<{
  /** Text content to display */
  text: string
  /** Optional secondary hint text */
  secondaryText?: string
  /** Optional segmentation groups */
  segmentation?: SegmentationGroup[] | null
}>()

// Render mode state
const renderMode = ref<RenderMode>('plain')
const highlightedHtml = shallowRef<string>('')
const markdownHtml = shallowRef<string>('')
const isHighlighting = ref(false)
const isRenderingMarkdown = ref(false)

// Detect if content looks like code
const looksLikeCode = computed(() => {
  const text = props.text.trim()
  if (!text || text.length < 10)
    return false
  // Check for common code patterns
  const codePatterns = [
    /[;{}()[\]]/,
    /^\s*(import|export|const|let|var|function|class|def|fn|pub|async|await)\s/m,
    /^\s*(if|else|for|while|switch|case|return|try|catch)\s*[({]/m,
    /=>|->|::|\.\.\.|\?\./,
    /^\s*[#@]/m,
    /```/,
  ]
  return codePatterns.some(pattern => pattern.test(text))
})

// Detect if content looks like Markdown
const looksLikeMarkdown = computed(() => {
  const text = props.text.trim()
  if (!text || text.length < 5)
    return false
  // Check for common Markdown patterns
  const mdPatterns = [
    /^#{1,6}\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])$/m, // Headers
    /^\s*[-*+]\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])$/m, // Unordered lists
    /^\s*\d+\.\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])$/m, // Ordered lists
    /\[.+\]\(.+\)/, // Links
    /!\[.*\]\(.+\)/, // Images
    /\*\*.+\*\*/, // Bold
    /\*.+\*/, // Italic
    /`[^`]+`/, // Inline code
    /^```/m, // Code blocks
    /^>\s+(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF])$/m, // Blockquotes
    /^\|.+\|$/m, // Tables
  ]
  const matchCount = mdPatterns.filter(pattern => pattern.test(text)).length
  return matchCount >= 2
})

// Lazy load shiki for code highlighting
async function highlightCode(code: string): Promise<string> {
  try {
    const { codeToHtml } = await import('shiki')
    // Try to detect language
    const lang = detectLanguage(code)
    const html = await codeToHtml(code, {
      lang,
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    })
    return html
  }
  catch (error) {
    console.error('Failed to highlight code:', error)
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
}

function detectLanguage(code: string): string {
  const trimmed = code.trim()
  // Simple language detection heuristics - use non-capturing groups (?:...)
  if (/^\s*(?:import|export|const|let|var|function|class)\s/m.test(trimmed))
    return /:\s*(?:string|number|boolean|any|void)\s*[=;,)]/.test(trimmed) ? 'typescript' : 'javascript'
  if (/^\s*(?:def|class|import|from|if __name__|print\()/m.test(trimmed))
    return 'python'
  if (/^\s*(?:fn|let|mut|impl|struct|enum|pub|use|mod)\s/m.test(trimmed))
    return 'rust'
  if (/^\s*(?:package|func|import|type|struct|interface)\s/m.test(trimmed))
    return 'go'
  if (/^\s*(?:public|private|protected|class|interface|void|int|String)\s/m.test(trimmed))
    return 'java'
  if (/^\s*(?:<\?php|namespace|use|class|function|public|private)/m.test(trimmed))
    return 'php'
  if (/^\s*(?:#include|int main|void|printf|scanf)/m.test(trimmed))
    return 'c'
  if (/^\s*(?:#include|std::|cout|cin|class|template)/m.test(trimmed))
    return 'cpp'
  if (/^\s*(?:<[a-z]+|<\/[a-z]+>|<!DOCTYPE)/im.test(trimmed))
    return 'html'
  if (/^\s*(?:\{|\[)[\s\S]*(?:\}|\])$/m.test(trimmed))
    return 'json'
  if (/^\s*(?:[.#]?[a-z-]+\s*\{|@media|@import)/im.test(trimmed))
    return 'css'
  if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/im.test(trimmed))
    return 'sql'
  if (/^\s*#!/m.test(trimmed))
    return 'bash'
  return 'text'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Simple Markdown renderer
async function renderMarkdown(text: string): Promise<string> {
  try {
    // Try to use a simple markdown parser
    // For now, implement basic markdown rendering
    let html = escapeHtml(text)

    // Code blocks (must be first to avoid conflicts)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre class="markdown-code-block"><code>${code.trim()}</code></pre>`
    })

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>')

    // Headers - use space and [^\n]+ to avoid backtracking issues
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^###### +([^\n]+)$/gm, '<h6>$1</h6>')
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^##### +([^\n]+)$/gm, '<h5>$1</h5>')
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^#### +([^\n]+)$/gm, '<h4>$1</h4>')
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^### +([^\n]+)$/gm, '<h3>$1</h3>')
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^## +([^\n]+)$/gm, '<h2>$1</h2>')
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^# +([^\n]+)$/gm, '<h1>$1</h1>')

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
    html = html.replace(/_(.+?)_/g, '<em>$1</em>')

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')

    // Blockquotes
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^&gt; +([^\n]+)$/gm, '<blockquote>$1</blockquote>')

    // Horizontal rules
    html = html.replace(/^-{3,}$/gm, '<hr />')
    html = html.replace(/^\*{3,}$/gm, '<hr />')

    // Unordered lists
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^[-*+] +([^\n]+)$/gm, '<li>$1</li>')
    html = html.replace(/(?:<li>[^<]*<\/li>\n?)+/g, '<ul>$&</ul>')

    // Ordered lists
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    html = html.replace(/^\d+\. +([^\n]+)$/gm, '<li>$1</li>')

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>')
    html = html.replace(/\n/g, '<br />')

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<'))
      html = `<p>${html}</p>`

    return html
  }
  catch (error) {
    console.error('Failed to render markdown:', error)
    return `<pre>${escapeHtml(text)}</pre>`
  }
}

// Watch for render mode changes
watchEffect(async () => {
  if (renderMode.value === 'code' && props.text) {
    isHighlighting.value = true
    try {
      highlightedHtml.value = await highlightCode(props.text)
    }
    finally {
      isHighlighting.value = false
    }
  }
})

watchEffect(async () => {
  if (renderMode.value === 'markdown' && props.text) {
    isRenderingMarkdown.value = true
    try {
      markdownHtml.value = await renderMarkdown(props.text)
    }
    finally {
      isRenderingMarkdown.value = false
    }
  }
})

// Auto-detect and set render mode when text changes
watch(() => props.text, () => {
  highlightedHtml.value = ''
  markdownHtml.value = ''
  // Default to code or markdown rendering if detected
  if (looksLikeCode.value) {
    renderMode.value = 'code'
  }
  else if (looksLikeMarkdown.value) {
    renderMode.value = 'markdown'
  }
  else {
    renderMode.value = 'plain'
  }
}, { immediate: true })

function setRenderMode(mode: RenderMode) {
  renderMode.value = renderMode.value === mode ? 'plain' : mode
}

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
    <!-- Render mode toggle buttons -->
    <div v-if="looksLikeCode || looksLikeMarkdown" class="flex items-center gap-2 px-3.5 pt-2">
      <button
        v-if="looksLikeCode"
        type="button"
        class="render-toggle-btn"
        :class="{ active: renderMode === 'code' }"
        :disabled="isHighlighting"
        @click="setRenderMode('code')"
      >
        <span class="i-carbon-code" aria-hidden="true" />
        <span>{{ renderMode === 'code' ? '显示原文' : '代码高亮' }}</span>
      </button>
      <button
        v-if="looksLikeMarkdown"
        type="button"
        class="render-toggle-btn"
        :class="{ active: renderMode === 'markdown' }"
        :disabled="isRenderingMarkdown"
        @click="setRenderMode('markdown')"
      >
        <span class="i-carbon-document" aria-hidden="true" />
        <span>{{ renderMode === 'markdown' ? '显示原文' : 'Markdown' }}</span>
      </button>
    </div>

    <!-- Code highlighted view -->
    <div
      v-if="renderMode === 'code' && highlightedHtml"
      class="code-preview m-0 overflow-auto rounded-lg p-3.5 text-3.7 leading-relaxed"
      v-html="highlightedHtml"
    />

    <!-- Markdown rendered view -->
    <div
      v-else-if="renderMode === 'markdown' && markdownHtml"
      class="markdown-preview m-0 max-w-none p-3.5 text-3.7 leading-relaxed prose prose-sm"
      v-html="markdownHtml"
    />

    <!-- Plain text view -->
    <pre
      v-else
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
.render-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--clipboard-border-color) 70%, transparent);
  background: var(--clipboard-surface-ghost);
  color: var(--clipboard-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.render-toggle-btn:hover:not(:disabled) {
  border-color: var(--clipboard-color-accent, #6366f1);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 8%, transparent);
}

.render-toggle-btn.active {
  border-color: var(--clipboard-color-accent, #6366f1);
  background: color-mix(in srgb, var(--clipboard-color-accent, #6366f1) 14%, transparent);
  color: var(--clipboard-color-accent-strong, var(--clipboard-color-accent, #6366f1));
}

.render-toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.code-preview {
  background: var(--clipboard-surface-strong);
  font-family: 'DM Mono', 'Fira Code', monospace;
}

.code-preview :deep(pre) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow-x: auto;
}

.code-preview :deep(code) {
  font-family: inherit;
  font-size: inherit;
  line-height: 1.6;
}

.markdown-preview {
  color: var(--clipboard-text-primary);
}

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin: 0.8em 0 0.4em;
  font-weight: 600;
  color: var(--clipboard-text-primary);
}

.markdown-preview :deep(h1) {
  font-size: 1.5em;
}
.markdown-preview :deep(h2) {
  font-size: 1.3em;
}
.markdown-preview :deep(h3) {
  font-size: 1.15em;
}
.markdown-preview :deep(h4) {
  font-size: 1.05em;
}

.markdown-preview :deep(p) {
  margin: 0.5em 0;
}

.markdown-preview :deep(a) {
  color: var(--clipboard-color-accent, #6366f1);
  text-decoration: underline;
}

.markdown-preview :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--clipboard-surface-strong);
  font-family: 'DM Mono', monospace;
  font-size: 0.9em;
}

.markdown-preview :deep(pre) {
  margin: 0.8em 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--clipboard-surface-strong);
  overflow-x: auto;
}

.markdown-preview :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-preview :deep(blockquote) {
  margin: 0.8em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--clipboard-color-accent, #6366f1);
  background: var(--clipboard-surface-ghost);
  color: var(--clipboard-text-secondary);
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-preview :deep(li) {
  margin: 0.25em 0;
}

.markdown-preview :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid var(--clipboard-border-color);
}

.markdown-preview :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.markdown-preview :deep(strong) {
  font-weight: 600;
}

.markdown-preview :deep(del) {
  text-decoration: line-through;
  opacity: 0.7;
}

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

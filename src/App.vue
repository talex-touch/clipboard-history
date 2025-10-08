<script setup lang="ts">
import { Toaster } from 'vue-sonner'

useHead({
  title: 'ClipboardManager',
  meta: [
    {
      name: 'description',
      content: 'ClipboardManager - 剪贴板历史记录',
    },
    {
      name: 'theme-color',
      content: () => (isDark.value ? '#00aba9' : '#ffffff'),
    },
  ],
  link: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: () => (preferredDark.value ? '/favicon-dark.svg' : '/favicon.svg'),
    },
  ],
})
</script>

<template>
  <RouterView />
  <Toaster position="top-center" :theme="isDark ? 'dark' : 'light'" />
</template>

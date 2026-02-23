<script setup lang="ts">
import { ref } from 'vue'

defineOptions({
  name: 'TheCounter',
})

const props = defineProps<{
  initial: number
}>()

const count = ref(props.initial)
</script>

<template>
  <div>
    {{ count }} <button class="inc" @click="count += 1">
      +
    </button><button class="dec" @click="count -= 1">
      -
    </button>
  </div>
</template>

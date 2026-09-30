<template>
  <section class="empty-state" role="status">
    <span class="empty-glyph" aria-hidden="true">{{ glyph }}</span>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <slot />
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; description: string; glyph?: string }>(), { glyph: '⌁' })
</script>

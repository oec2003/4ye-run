<template>
  <template v-for="(span, index) in spans" :key="index">
    <a v-if="span.href" :href="span.href" target="_blank" rel="noopener noreferrer" class="inline-link">
      <strong v-if="span.bold"><em v-if="span.italic">{{ span.text }}</em><template v-else>{{ span.text }}</template></strong>
      <em v-else-if="span.italic">{{ span.text }}</em>
      <template v-else>{{ span.text }}</template>
    </a>
    <strong v-else-if="span.bold"><em v-if="span.italic">{{ span.text }}</em><template v-else>{{ span.text }}</template></strong>
    <em v-else-if="span.italic">{{ span.text }}</em>
    <template v-else>{{ span.text }}</template>
  </template>
</template>

<script setup lang="ts">
import type { TextSpan } from '~/contracts/types'
defineProps<{ spans: TextSpan[] }>()
</script>

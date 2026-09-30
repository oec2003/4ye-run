<template>
  <nav v-if="totalPages > 1" class="pagination" aria-label="分页">
    <button type="button" :disabled="page <= 1" @click="$emit('change', page - 1)">上一页</button>
    <span>第 {{ page }} / {{ totalPages }} 页</span>
    <button type="button" :disabled="page >= totalPages" @click="$emit('change', page + 1)">下一页</button>
  </nav>
</template>

<script setup lang="ts">
const props = defineProps<{ page: number; pageSize: number; total: number }>()
defineEmits<{ change: [page: number] }>()
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

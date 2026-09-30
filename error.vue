<template>
  <div class="standalone-error">
    <p class="eyebrow">{{ error.statusCode === 404 ? '404 · NOT FOUND' : 'PAGE ERROR' }}</p>
    <h1>{{ error.statusCode === 404 ? '这页跑远了' : '页面暂时没有打开' }}</h1>
    <p>{{ error.statusCode === 404 ? '内容可能尚未发布、已经下架，或链接有误。' : '请稍后再试。' }}</p>
    <NuxtLink class="button-primary" to="/" @click="clearError({ redirect: '/' })">返回首页</NuxtLink>
  </div>
</template>

<script setup lang="ts">
defineProps<{ error: { statusCode: number; statusMessage?: string } }>()
</script>

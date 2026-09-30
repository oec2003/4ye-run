<template>
  <div class="page-width article-page essay-detail">
    <template v-if="essay">
      <NuxtLink class="back-link" to="/essays">返回小作文</NuxtLink>
      <article>
        <header class="article-header">
          <p class="article-type">{{ essay.format === 'image' ? '图片长文' : '小作文' }}</p>
          <h1>{{ essay.title }}</h1>
          <div class="author-line">
            <span class="author-avatar" aria-hidden="true">{{ essay.authorDisplayName.replace(/^@/, '').slice(0, 1) || '野' }}</span>
            <div><strong>{{ essay.authorDisplayName }}</strong><time :datetime="essay.publishedAt">{{ formatShanghaiDate(essay.publishedAt) }}</time></div>
            <NuxtLink v-if="essay.authorMemberId" class="text-link" :to="`/members/${essay.authorMemberId}`">作者名片</NuxtLink>
          </div>
          <p class="article-summary">{{ essay.summary }}</p>
        </header>
        <BodyBlocks :blocks="essay.bodyBlocks" :assets="essay.assets" @open-image="openImage" />
      </article>
      <div class="article-actions single-action">
        <button class="button-primary" type="button" @click="sharePage(essay.title, essay.summary)"><AppIcon name="share" />分享文章</button>
      </div>
      <p v-if="shareMessage" class="action-message" role="status">{{ shareMessage }}</p>
      <ImageLightbox ref="lightbox" />
    </template>
    <section v-else-if="error" class="error-state" role="alert"><h1>文章暂时没有加载出来</h1><p>请检查网络后再试一次。</p><button class="button-secondary" type="button" @click="refresh">重新加载</button></section>
  </div>
</template>

<script setup lang="ts">
import type { ApiSuccess, ContentDetail } from '~/contracts/types'
import { formatShanghaiDate } from '~/utils/format'
const route = useRoute()
const config = useRuntimeConfig()
const lightbox = ref<{ open: (url: string, source?: HTMLElement | null) => void } | null>(null)
const { shareMessage, sharePage } = useSharePage()
const { data: response, error, refresh } = await useFetch<ApiSuccess<ContentDetail>>(`${config.public.apiBaseUrl}/essays/${route.params.id}`)
if (error.value && (error.value.statusCode === 404 || error.value.status === 404)) throw createError({ statusCode: 404, message: '未找到这篇小作文' })
const essay = computed(() => response.value?.data)
function openImage(url: string) { lightbox.value?.open(url, document.activeElement as HTMLElement | null) }
useSeoMeta({ title: computed(() => essay.value ? `${essay.value.title}｜四野云跑` : '小作文｜四野云跑'), description: computed(() => essay.value?.summary || '四野跑友的小作文') })
</script>

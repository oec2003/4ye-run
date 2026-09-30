<template>
  <div class="page-width article-page">
    <template v-if="report">
      <NuxtLink class="back-link" to="/">返回周报</NuxtLink>
      <article>
        <header class="article-header">
          <p class="article-type">云跑周报</p>
          <h1>{{ report.title }}</h1>
          <div class="article-meta-row">
            <time :datetime="report.publishedAt">发布于 {{ formatShanghaiDate(report.publishedAt) }}</time>
            <span>{{ formatPeriod(report.periodStart, report.periodEnd) }}</span>
          </div>
          <p v-if="report.contributors.length" class="contributors">整理：{{ report.contributors.map(item => item.displayName).join('、') }}</p>
          <p class="article-summary">{{ report.summary }}</p>
          <dl v-if="statEntries.length" class="article-stats">
            <div v-for="stat in statEntries" :key="stat.label"><dd>{{ stat.value }}</dd><dt>{{ stat.label }}</dt></div>
          </dl>
        </header>
        <BodyBlocks :blocks="report.bodyBlocks" :assets="report.assets" @open-image="openImage" />
      </article>

      <div class="article-actions">
        <button v-if="posterUrl" class="button-secondary" type="button" @click="openImage(posterUrl)"><AppIcon name="image" />查看海报</button>
        <button class="button-primary" type="button" @click="sharePage(report.title, report.summary)"><AppIcon name="share" />分享本期</button>
      </div>
      <p v-if="shareMessage" class="action-message" role="status">{{ shareMessage }}</p>
      <ImageLightbox ref="lightbox" />
    </template>

    <section v-else-if="error" class="error-state" role="alert">
      <h1>周报暂时没有加载出来</h1><p>请检查网络后再试一次。</p>
      <button class="button-secondary" type="button" @click="refresh">重新加载</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ApiSuccess, ContentDetail } from '~/contracts/types'
import { formatPeriod, formatShanghaiDate } from '~/utils/format'
const route = useRoute()
const config = useRuntimeConfig()
const lightbox = ref<{ open: (url: string, source?: HTMLElement | null) => void } | null>(null)
const { shareMessage, sharePage } = useSharePage()
const { data: response, error, refresh } = await useFetch<ApiSuccess<ContentDetail>>(`${config.public.apiBaseUrl}/reports/${route.params.id}`)
if (error.value && (error.value.statusCode === 404 || error.value.status === 404)) throw createError({ statusCode: 404, message: '未找到这期周报' })
const report = computed(() => response.value?.data)
const posterUrl = computed(() => report.value?.posterAssetId ? report.value.assets[report.value.posterAssetId]?.publicUrl || '' : '')
const statEntries = computed(() => {
  if (!report.value?.stats) return []
  const stats = report.value.stats
  return [
    stats.totalDistanceKm == null ? null : { label: '公里', value: stats.totalDistanceKm.toLocaleString('zh-CN') },
    stats.participantCount == null ? null : { label: '位跑友', value: String(stats.participantCount) },
    stats.participationCount == null ? null : { label: '人次', value: String(stats.participationCount) },
    stats.activeDays == null ? null : { label: '天同行', value: String(stats.activeDays) }
  ].filter(Boolean) as Array<{ label: string; value: string }>
})
function openImage(url: string) { lightbox.value?.open(url, document.activeElement as HTMLElement | null) }
useSeoMeta({
  title: computed(() => report.value ? `${report.value.title}｜四野云跑` : '周报｜四野云跑'),
  description: computed(() => report.value?.summary || '四野云跑周报'),
  ogTitle: computed(() => report.value?.title || '四野云跑周报'),
  ogDescription: computed(() => report.value?.summary || '四野云跑周报')
})
</script>

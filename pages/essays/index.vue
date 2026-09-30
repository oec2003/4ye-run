<template>
  <div>
    <section class="page-hero essay-hero">
      <div class="page-width hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">RUNNER STORIES</p>
          <h1>小作文</h1>
          <p>成绩之外，还有好多话想说。</p>
        </div>
        <div class="notebook-art" aria-hidden="true"><span></span><i></i><b></b></div>
      </div>
    </section>

    <div class="page-width section-stack">
      <form class="filter-bar" role="search" @submit.prevent="applySearch">
        <label class="search-field wide">
          <AppIcon name="search" />
          <span class="sr-only">搜索小作文</span>
          <input v-model="keywordInput" type="search" placeholder="搜索标题、作者或摘要" />
        </label>
        <button class="button-secondary" type="submit">搜索</button>
      </form>

      <div class="section-heading split-heading">
        <div><p class="section-kicker">ESSAYS</p><h2>全部文章</h2></div>
        <p>{{ response?.meta?.total ?? 0 }} 篇</p>
      </div>

      <div v-if="pending" class="skeleton-stack"><span v-for="n in 3" :key="n" class="skeleton-card"></span></div>
      <section v-else-if="error" class="error-state" role="alert">
        <h2>小作文暂时没有加载出来</h2><p>请检查网络后再试一次。</p>
        <button class="button-secondary" type="button" @click="refresh">重新加载</button>
      </section>
      <EmptyState v-else-if="!items.length" title="这里还没有文章" description="没有匹配当前搜索的小作文。" glyph="✎" />
      <div v-else class="essay-list">
        <article v-for="essay in items" :key="essay.id" class="essay-card">
          <div class="essay-monogram" aria-hidden="true">{{ essay.authorDisplayName.replace(/^@/, '').slice(0, 1) || '野' }}</div>
          <div class="essay-card-copy">
            <div class="card-meta"><span>{{ essay.format === 'image' ? '图片长文' : '文字随笔' }}</span><time :datetime="essay.publishedAt">{{ formatShanghaiDate(essay.publishedAt) }}</time></div>
            <h2><NuxtLink :to="`/essays/${essay.id}`">{{ essay.title }}</NuxtLink></h2>
            <p class="essay-author">{{ essay.authorDisplayName }}</p>
            <p>{{ essay.summary }}</p>
            <NuxtLink class="text-link" :to="`/essays/${essay.id}`">读一读</NuxtLink>
          </div>
        </article>
      </div>
      <PaginationNav v-if="response?.meta" :page="response.meta.page" :page-size="response.meta.pageSize" :total="response.meta.total" @change="goToPage" />
      <aside class="contribute-note">
        <span>你也有故事想分享？</span><NuxtLink to="/about#contribute">查看投稿说明</NuxtLink>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiSuccess, ContentSummary } from '~/contracts/types'
import { formatShanghaiDate } from '~/utils/format'
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const keywordInput = ref(typeof route.query.keyword === 'string' ? route.query.keyword : '')
const currentPage = computed(() => Math.max(1, Number(route.query.page) || 1))
const requestUrl = computed(() => {
  const query = new URLSearchParams({ page: String(currentPage.value), pageSize: '8' })
  if (typeof route.query.keyword === 'string' && route.query.keyword) query.set('keyword', route.query.keyword)
  return `${config.public.apiBaseUrl}/essays?${query}`
})
const { data: response, pending, error, refresh } = await useFetch<ApiSuccess<ContentSummary[]>>(requestUrl)
const items = computed(() => response.value?.data ?? [])
const applySearch = () => router.push({ query: keywordInput.value.trim() ? { keyword: keywordInput.value.trim() } : {} })
const goToPage = (page: number) => router.push({ query: { ...route.query, page: String(page) } })
useSeoMeta({ title: '小作文｜四野云跑', description: '阅读四野跑友写下的训练、比赛与生活故事。' })
</script>

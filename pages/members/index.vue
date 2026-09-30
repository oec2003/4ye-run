<template>
  <div>
    <section class="page-hero members-hero">
      <div class="page-width hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">RUNNERS & FRIENDS</p>
          <h1>跑友</h1>
          <p>在跑道之外，认识彼此。</p>
        </div>
        <div class="orbit-art" aria-hidden="true"><span></span><i></i><b></b></div>
      </div>
    </section>

    <div class="page-width section-stack">
      <form class="filter-bar" role="search" @submit.prevent="applyFilters">
        <label class="search-field wide"><AppIcon name="search" /><span class="sr-only">搜索跑友或账号</span><input v-model="keywordInput" type="search" placeholder="搜索跑友或账号" /></label>
        <label class="select-field"><span class="sr-only">按平台筛选</span><select v-model="platformInput" @change="applyFilters"><option value="">全部平台</option><option value="xiaoyuzhou">小宇宙</option><option value="xiaohongshu">小红书</option><option value="wechat_official">公众号</option><option value="website">网站</option><option value="other">其他</option></select></label>
        <button class="button-secondary" type="submit">筛选</button>
      </form>

      <div v-if="pending" class="skeleton-stack"><span v-for="n in 3" :key="n" class="skeleton-card"></span></div>
      <section v-else-if="error" class="error-state" role="alert"><h2>跑友资料暂时没有加载出来</h2><p>请检查网络后再试一次。</p><button class="button-secondary" type="button" @click="refresh">重新加载</button></section>
      <EmptyState v-else-if="!items.length" title="跑友名片正在整理中" description="这里不会展示参考稿里的示例账号。正式名片会由群内整理者确认后发布。" glyph="◎">
        <NuxtLink class="button-primary" to="/about#members">了解名片收录方式</NuxtLink>
      </EmptyState>
      <div v-else class="member-grid">
        <article v-for="member in items" :key="member.id" class="member-card">
          <div class="member-avatar" aria-hidden="true">{{ member.displayName.slice(0, 1) }}</div>
          <div><h2><NuxtLink :to="`/members/${member.id}`">{{ member.displayName }}</NuxtLink></h2><p>{{ member.bio }}</p><ul class="platform-tags"><li v-for="platform in member.platforms" :key="platform">{{ platformLabel(platform) }}</li></ul></div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiSuccess, MemberPlatform, MemberSummary } from '~/contracts/types'
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const keywordInput = ref(typeof route.query.keyword === 'string' ? route.query.keyword : '')
const platformInput = ref(typeof route.query.platform === 'string' ? route.query.platform : '')
const requestUrl = computed(() => {
  const query = new URLSearchParams({ page: '1', pageSize: '50' })
  if (typeof route.query.keyword === 'string' && route.query.keyword) query.set('keyword', route.query.keyword)
  if (typeof route.query.platform === 'string' && route.query.platform) query.set('platform', route.query.platform)
  return `${config.public.apiBaseUrl}/members?${query}`
})
const { data: response, pending, error, refresh } = await useFetch<ApiSuccess<MemberSummary[]>>(requestUrl)
const items = computed(() => response.value?.data ?? [])
function applyFilters() { router.push({ query: { ...(keywordInput.value.trim() ? { keyword: keywordInput.value.trim() } : {}), ...(platformInput.value ? { platform: platformInput.value } : {}) } }) }
const labels: Record<MemberPlatform, string> = { xiaoyuzhou: '小宇宙', xiaohongshu: '小红书', wechat_official: '公众号', website: '网站', other: '其他' }
const platformLabel = (platform: MemberPlatform) => labels[platform]
useSeoMeta({ title: '跑友｜四野云跑', description: '认识四野跑友以及他们公开分享的账号。' })
</script>

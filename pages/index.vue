<template>
  <div>
    <section class="page-hero report-hero">
      <div class="page-width hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">WEEKLY RUNNING NOTES</p>
          <h1>云跑周报</h1>
          <p>每一周，都是我们一起跑过的路。</p>
        </div>
        <div class="trail-art" aria-hidden="true">
          <span class="sun"></span>
          <span class="ridge ridge-one"></span>
          <span class="ridge ridge-two"></span>
          <span class="trail"></span>
        </div>
      </div>
    </section>

    <div class="page-width section-stack">
      <section aria-labelledby="reports-heading">
        <div class="section-heading split-heading">
          <div>
            <p class="section-kicker">REPORTS</p>
            <h2 id="reports-heading">周报归档</h2>
          </div>
          <p>共 {{ response?.meta?.total ?? 0 }} 期</p>
        </div>

        <form class="filter-bar" role="search" @submit.prevent="applyFilters">
          <label class="search-field">
            <AppIcon name="search" />
            <span class="sr-only">搜索周报</span>
            <input v-model="keywordInput" type="search" placeholder="搜索标题或摘要" />
          </label>
          <label class="select-field">
            <AppIcon name="calendar" />
            <span class="sr-only">按年份筛选</span>
            <select v-model="yearInput" @change="applyFilters">
              <option value="">全部年份</option>
              <option v-for="year in yearOptions" :key="year" :value="year">{{ year }} 年</option>
            </select>
          </label>
          <button class="button-secondary" type="submit">筛选</button>
        </form>

        <div v-if="pending" class="skeleton-stack" aria-live="polite" aria-label="周报加载中">
          <span v-for="n in 3" :key="n" class="skeleton-card"></span>
        </div>
        <section v-else-if="error" class="error-state" role="alert">
          <h2>周报暂时没有加载出来</h2>
          <p>请检查网络后再试一次。</p>
          <button class="button-secondary" type="button" @click="refresh">重新加载</button>
        </section>
        <EmptyState v-else-if="!items.length" title="没有找到周报" description="换一个年份或关键词试试。" />
        <div v-else class="report-grid">
          <article v-for="(report, index) in items" :key="report.id" :class="['report-card', { featured: index === 0 && currentPage === 1 }]">
            <div class="report-card-accent" aria-hidden="true">
              <span>{{ formatShanghaiDate(report.publishedAt).slice(0, 4) }}</span>
              <strong>{{ formatShanghaiDate(report.publishedAt).slice(5) }}</strong>
            </div>
            <div class="report-card-body">
              <div class="card-meta">
                <span>云跑周报</span>
                <time :datetime="report.publishedAt">{{ formatShanghaiDate(report.publishedAt) }}</time>
              </div>
              <h3><NuxtLink :to="`/reports/${report.id}`">{{ report.title }}</NuxtLink></h3>
              <p>{{ report.summary }}</p>
              <dl v-if="statEntries(report).length" class="compact-stats">
                <div v-for="stat in statEntries(report)" :key="stat.label"><dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd></div>
              </dl>
              <div class="card-footer">
                <span>{{ formatPeriod(report.periodStart, report.periodEnd) }}</span>
                <NuxtLink class="text-link" :to="`/reports/${report.id}`">阅读本期</NuxtLink>
              </div>
            </div>
          </article>
        </div>
        <PaginationNav v-if="response?.meta" :page="response.meta.page" :page-size="response.meta.pageSize" :total="response.meta.total" @change="goToPage" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiSuccess, ContentSummary } from '~/contracts/types'
import { formatPeriod, formatShanghaiDate } from '~/utils/format'

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const currentPage = computed(() => Math.max(1, Number(route.query.page) || 1))
const keywordInput = ref(typeof route.query.keyword === 'string' ? route.query.keyword : '')
const yearInput = ref(typeof route.query.year === 'string' ? route.query.year : '')
const requestUrl = computed(() => {
  const query = new URLSearchParams({ page: String(currentPage.value), pageSize: '6' })
  if (typeof route.query.keyword === 'string' && route.query.keyword) query.set('keyword', route.query.keyword)
  if (typeof route.query.year === 'string' && route.query.year) query.set('year', route.query.year)
  return `${config.public.apiBaseUrl}/reports?${query}`
})
const { data: response, pending, error, refresh } = await useFetch<ApiSuccess<ContentSummary[]>>(requestUrl)
const items = computed(() => response.value?.data ?? [])
const yearOptions = computed(() => [...new Set(items.value.map((item) => formatShanghaiDate(item.publishedAt).slice(0, 4)))].sort().reverse())

function applyFilters() {
  router.push({ query: { ...(keywordInput.value.trim() ? { keyword: keywordInput.value.trim() } : {}), ...(yearInput.value ? { year: yearInput.value } : {}) } })
}
function goToPage(page: number) {
  router.push({ query: { ...route.query, page: String(page) } })
  window.scrollTo({ top: 280, behavior: 'smooth' })
}
function statEntries(report: ContentSummary) {
  if (!report.stats) return []
  return [
    report.stats.totalDistanceKm == null ? null : { label: '公里', value: report.stats.totalDistanceKm.toLocaleString('zh-CN') },
    report.stats.participantCount == null ? null : { label: '位跑友', value: String(report.stats.participantCount) },
    report.stats.participationCount == null ? null : { label: '人次', value: String(report.stats.participationCount) },
    report.stats.activeDays == null ? null : { label: '天同行', value: String(report.stats.activeDays) }
  ].filter(Boolean) as Array<{ label: string; value: string }>
}

useSeoMeta({
  title: '云跑周报｜四野云跑',
  description: '查看四野云跑每周整理的跑步周报。',
  ogTitle: '云跑周报｜四野云跑',
  ogDescription: '每一周，都是我们一起跑过的路。'
})
</script>

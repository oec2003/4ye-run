<template>
  <div class="page-width member-detail-page">
    <template v-if="member">
      <NuxtLink class="back-link" to="/members">返回跑友</NuxtLink>
      <header class="member-profile">
        <div class="member-avatar large" aria-hidden="true">{{ member.displayName.slice(0, 1) }}</div>
        <div><p class="article-type">跑友名片</p><h1>{{ member.displayName }}</h1><p>{{ member.bio }}</p></div>
      </header>
      <section aria-labelledby="accounts-heading">
        <div class="section-heading"><p class="section-kicker">ACCOUNTS</p><h2 id="accounts-heading">公开账号</h2></div>
        <div v-if="member.accounts.length" class="account-list">
          <article v-for="account in member.accounts" :key="account.id" class="account-row">
            <div><span class="platform-pill">{{ platformLabel(account.platform) }}</span><h3>{{ account.accountName }}</h3><p v-if="account.description">{{ account.description }}</p></div>
            <div class="account-actions">
              <button type="button" @click="copyAccount(account.accountId || account.url || account.accountName)"><AppIcon name="copy" />复制</button>
              <a v-if="safeUrl(account.url)" :href="account.url!" target="_blank" rel="noopener noreferrer"><AppIcon name="external" />打开</a>
            </div>
          </article>
        </div>
        <EmptyState v-else title="暂无公开账号" description="这位跑友还没有提供可公开的账号信息。" />
        <p v-if="copyMessage" class="action-message" role="status">{{ copyMessage }}</p>
      </section>
    </template>
    <section v-else-if="error" class="error-state" role="alert"><h1>名片暂时没有加载出来</h1><p>请检查网络后再试一次。</p><button class="button-secondary" type="button" @click="refresh">重新加载</button></section>
  </div>
</template>

<script setup lang="ts">
import { isSafeExternalUrl } from '~/contracts/body-blocks'
import type { ApiSuccess, MemberDetail, MemberPlatform } from '~/contracts/types'
const route = useRoute()
const config = useRuntimeConfig()
const copyMessage = ref('')
const { data: response, error, refresh } = await useFetch<ApiSuccess<MemberDetail>>(`${config.public.apiBaseUrl}/members/${route.params.id}`)
if (error.value && (error.value.statusCode === 404 || error.value.status === 404)) throw createError({ statusCode: 404, message: '未找到这位跑友' })
const member = computed(() => response.value?.data)
const labels: Record<MemberPlatform, string> = { xiaoyuzhou: '小宇宙', xiaohongshu: '小红书', wechat_official: '公众号', website: '网站', other: '其他' }
const platformLabel = (platform: MemberPlatform) => labels[platform]
const safeUrl = (url: string | null) => Boolean(url && isSafeExternalUrl(url))
async function copyAccount(value: string) {
  try { await navigator.clipboard.writeText(value); copyMessage.value = '账号信息已复制。' }
  catch { copyMessage.value = '复制失败，请手动选择账号信息。' }
}
useSeoMeta({ title: computed(() => member.value ? `${member.value.displayName}｜四野云跑` : '跑友名片｜四野云跑'), description: computed(() => member.value?.bio || '四野跑友公开名片') })
</script>

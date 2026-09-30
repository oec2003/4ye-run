<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">跳到正文</a>
    <header class="site-header">
      <div class="header-inner">
        <NuxtLink class="brand" to="/" aria-label="四野云跑首页">
          <span class="brand-mark" aria-hidden="true">四</span>
          <span>四野云跑</span>
        </NuxtLink>
        <nav class="desktop-nav" aria-label="主导航">
          <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }">
            {{ item.label }}
          </NuxtLink>
        </nav>
        <span class="header-note">RUN FOR LOVE</span>
      </div>
    </header>

    <main id="main-content" tabindex="-1">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="footer-inner">
        <div>
          <strong>四野云跑</strong>
          <p>记录我们一起跑过的路。</p>
        </div>
        <NuxtLink to="/about">关于与投稿说明</NuxtLink>
      </div>
    </footer>

    <nav class="mobile-nav" aria-label="移动端主导航">
      <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }">
        <AppIcon :name="item.icon" />
        <span>{{ item.shortLabel }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const navItems = [
  { to: '/', label: '云跑周报', shortLabel: '周报', icon: 'report' },
  { to: '/essays', label: '小作文', shortLabel: '小作文', icon: 'essay' },
  { to: '/members', label: '跑友', shortLabel: '跑友', icon: 'members' }
]
const isActive = (to: string) => to === '/' ? route.path === '/' || route.path.startsWith('/reports') : route.path.startsWith(to)
</script>

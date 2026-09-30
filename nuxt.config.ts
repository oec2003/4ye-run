// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-30',
  devtools: { enabled: false },
  modules: [],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    workerApiBaseUrl: process.env.WORKER_API_BASE_URL || '',
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api/v1'
    }
  },
  routeRules: {
    '/api/v1/**': { cors: false }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '四野云跑',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#176b45' },
        { name: 'description', content: '四野云跑的周报、小作文与跑友故事。' }
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  }
})

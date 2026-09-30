<template>
  <dialog ref="dialog" class="lightbox" aria-labelledby="lightbox-title" @close="restoreFocus">
    <div class="lightbox-toolbar">
      <strong id="lightbox-title">原图预览</strong>
      <div class="lightbox-actions">
        <button type="button" aria-label="缩小" @click="zoom = Math.max(0.5, zoom - 0.25)"><AppIcon name="minus" /></button>
        <span aria-live="polite">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" aria-label="放大" @click="zoom = Math.min(3, zoom + 0.25)"><AppIcon name="plus" /></button>
        <button type="button" @click="downloadImage">下载</button>
        <button type="button" aria-label="关闭预览" @click="close"><AppIcon name="close" /></button>
      </div>
    </div>
    <div class="lightbox-stage">
      <img v-if="src" :src="src" alt="内容原图" :style="{ transform: `scale(${zoom})` }" />
    </div>
    <p v-if="message" class="lightbox-message" role="status">{{ message }}</p>
  </dialog>
</template>

<script setup lang="ts">
const dialog = ref<HTMLDialogElement | null>(null)
const src = ref('')
const zoom = ref(1)
const message = ref('')
let trigger: HTMLElement | null = null

function open(url: string, source?: HTMLElement | null) {
  if (!url) return
  src.value = url
  zoom.value = 1
  message.value = ''
  trigger = source || (document.activeElement as HTMLElement | null)
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
function restoreFocus() {
  trigger?.focus()
}
async function downloadImage() {
  try {
    const response = await fetch(src.value, { mode: 'cors' })
    if (!response.ok) throw new Error('download failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `4ye-run-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`
    anchor.click()
    URL.revokeObjectURL(objectUrl)
    message.value = '图片下载已开始。'
  } catch {
    window.open(src.value, '_blank', 'noopener,noreferrer')
    message.value = '浏览器未允许直接下载，已打开原图，可在新页面另存。'
  }
}
defineExpose({ open, close })
</script>

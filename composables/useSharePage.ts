export function useSharePage() {
  const shareMessage = ref('')

  async function sharePage(title: string, text: string) {
    shareMessage.value = ''
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        shareMessage.value = '已打开系统分享。'
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        shareMessage.value = '链接已复制。'
      } else {
        const input = document.createElement('textarea')
        input.value = url
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        const copied = document.execCommand('copy')
        input.remove()
        if (!copied) throw new Error('copy failed')
        shareMessage.value = '链接已复制。'
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') shareMessage.value = '分享失败，请从地址栏复制链接。'
    }
  }
  return { shareMessage, sharePage }
}

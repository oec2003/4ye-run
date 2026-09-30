import type { BodyBlock, TextSpan } from './types'

const SAFE_URL = /^https?:\/\//i
const ASSET_URL = /^asset:\/\/([0-9a-f-]{36})$/i

export interface MarkdownParseResult {
  blocks: BodyBlock[]
  warnings: string[]
}

export function isSafeExternalUrl(value: string): boolean {
  if (!SAFE_URL.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseInline(value: string, warnings: string[] = []): TextSpan[] {
  const spans: TextSpan[] = []
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let cursor = 0
  for (const match of value.matchAll(tokenPattern)) {
    const index = match.index ?? 0
    if (index > cursor) spans.push({ text: value.slice(cursor, index) })
    const token = match[0]
    if (token.startsWith('**')) {
      spans.push({ text: token.slice(2, -2), bold: true })
    } else if (token.startsWith('*')) {
      spans.push({ text: token.slice(1, -1), italic: true })
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link && isSafeExternalUrl(link[2])) spans.push({ text: link[1], href: link[2] })
      else {
        spans.push({ text: link?.[1] ?? token })
        warnings.push(`已移除不安全或不支持的链接：${link?.[2] ?? token}`)
      }
    }
    cursor = index + token.length
  }
  if (cursor < value.length) spans.push({ text: value.slice(cursor) })
  return spans.length ? spans : [{ text: '' }]
}

export function markdownToBodyBlocks(markdown: string): MarkdownParseResult {
  const warnings: string[] = []
  const blocks: BodyBlock[] = []
  const normalized = markdown.replace(/\r\n?/g, '\n').replace(/<[^>]*>/g, (html) => {
    warnings.push('正文中的 HTML 已作为不支持内容移除。')
    return html.replace(/[<>]/g, '')
  })
  const lines = normalized.split('\n')
  let paragraph: string[] = []
  let list: { ordered: boolean; items: TextSpan[][] } | null = null

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim()
    if (text) blocks.push({ type: 'paragraph', children: parseInline(text, warnings) })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items })
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (image) {
      flushParagraph()
      flushList()
      const assetMatch = image[2].match(ASSET_URL)
      if (assetMatch) blocks.push({ type: 'image', assetId: assetMatch[1], sourceUrl: null, alt: image[1] })
      else if (isSafeExternalUrl(image[2])) blocks.push({ type: 'image', assetId: null, sourceUrl: image[2], alt: image[1] })
      else warnings.push(`已跳过不安全的图片地址：${image[2]}`)
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3 | 4, children: parseInline(heading[2], warnings) })
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'divider' })
      continue
    }
    const quote = line.match(/^>\s?(.+)$/)
    if (quote) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'quote', children: parseInline(quote[1], warnings) })
      continue
    }
    const listItem = line.match(/^(?:(\d+)\.|[-*])\s+(.+)$/)
    if (listItem) {
      flushParagraph()
      const ordered = Boolean(listItem[1])
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push(parseInline(listItem[2], warnings))
      continue
    }
    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return { blocks, warnings: [...new Set(warnings)] }
}

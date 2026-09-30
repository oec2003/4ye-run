import type { ContentWrite } from './types'

export type ValidationResult<T> = { ok: true; data: T; errors: [] } | { ok: false; data: null; errors: string[] }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function validateContentWriteInput(value: unknown): ValidationResult<ContentWrite> {
  const errors: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, data: null, errors: ['content 必须是对象。'] }
  const item = value as Record<string, unknown>
  if (item.type !== 'report' && item.type !== 'essay') errors.push('content.type 无效。')
  if (item.format !== 'markdown' && item.format !== 'image') errors.push('content.format 无效。')
  for (const key of ['title', 'summary', 'bodyMarkdown', 'authorDisplayName', 'publishedAt']) if (typeof item[key] !== 'string') errors.push(`content.${key} 必须是字符串。`)
  if (typeof item.title === 'string' && (!item.title.trim() || item.title.length > 180)) errors.push('标题不能为空且最多 180 字。')
  if (typeof item.summary === 'string' && item.summary.length > 600) errors.push('摘要最多 600 字。')
  if (typeof item.publishedAt === 'string' && !Number.isFinite(Date.parse(item.publishedAt))) errors.push('publishedAt 必须是 ISO 8601 时间。')
  for (const key of ['coverAssetId', 'posterAssetId', 'authorMemberId']) if (item[key] != null && (typeof item[key] !== 'string' || !UUID.test(item[key]))) errors.push(`content.${key} 必须是 UUID 或 null。`)
  if (!Array.isArray(item.imageAssetIds)) errors.push('content.imageAssetIds 必须是数组。')
  else if (item.imageAssetIds.some((id) => typeof id !== 'string' || !UUID.test(id))) errors.push('content.imageAssetIds 包含无效 UUID。')
  if (!Array.isArray(item.contributors)) errors.push('content.contributors 必须是数组。')
  else for (const contributor of item.contributors) {
    if (!contributor || typeof contributor !== 'object' || typeof contributor.displayName !== 'string' || typeof contributor.role !== 'string' || (contributor.memberId != null && (typeof contributor.memberId !== 'string' || !UUID.test(contributor.memberId)))) errors.push('content.contributors 包含无效成员。')
  }
  if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string')) errors.push('content.tags 必须是字符串数组。')
  for (const key of ['periodStart', 'periodEnd']) if (item[key] != null && (typeof item[key] !== 'string' || !DATE.test(item[key]))) errors.push(`content.${key} 必须是 YYYY-MM-DD 或 null。`)
  if (item.stats != null && (typeof item.stats !== 'object' || Array.isArray(item.stats))) errors.push('content.stats 必须是对象或 null。')
  if (item.type === 'essay' && item.posterAssetId) errors.push('小作文不能设置 posterAssetId。')
  return errors.length ? { ok: false, data: null, errors } : { ok: true, data: item as unknown as ContentWrite, errors: [] }
}

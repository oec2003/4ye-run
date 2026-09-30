import fixtures from '../data/legacy-content.json'
import { markdownToBodyBlocks } from '../../contracts/body-blocks'
import type { ContentDetail, ContentSummary, MemberDetail, MemberSummary, PageMeta } from '../../contracts/types'

type FixtureContent = (typeof fixtures.reports)[number] | (typeof fixtures.essays)[number]

function publicSummary(item: FixtureContent): ContentSummary {
  return {
    id: item.id,
    type: item.type as ContentSummary['type'],
    title: item.title,
    summary: item.summary,
    format: item.format as ContentSummary['format'],
    coverAssetId: item.coverAssetId,
    posterAssetId: item.posterAssetId,
    authorMemberId: item.authorMemberId,
    authorDisplayName: item.authorDisplayName,
    contributors: item.contributors,
    tags: item.tags,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    stats: item.stats,
    version: item.version,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    coverUrl: null
  }
}

function publicDetail(item: FixtureContent): ContentDetail {
  return {
    ...publicSummary(item),
    bodyMarkdown: item.bodyMarkdown,
    bodyBlocks: markdownToBodyBlocks(item.bodyMarkdown).blocks,
    imageAssetIds: item.imageAssetIds,
    contentHash: item.contentHash,
    assets: {}
  }
}

function pageOf<T>(items: T[], page: number, pageSize: number): { data: T[]; meta: PageMeta } {
  const offset = (page - 1) * pageSize
  return {
    data: items.slice(offset, offset + pageSize),
    meta: { page, pageSize, total: items.length, hasMore: offset + pageSize < items.length }
  }
}

function searchContents(items: FixtureContent[], options: { keyword?: string; year?: string; tag?: string }) {
  const keyword = options.keyword?.trim().toLocaleLowerCase('zh-CN')
  return items
    .filter((item) => item.status === 'published')
    .filter((item) => !options.year || item.publishedAt.startsWith(`${options.year}-`))
    .filter((item) => !options.tag || item.tags.includes(options.tag))
    .filter((item) => !keyword || `${item.title} ${item.summary} ${item.authorDisplayName}`.toLocaleLowerCase('zh-CN').includes(keyword))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id))
}

export function listLocalContents(type: 'report' | 'essay', query: Record<string, string | undefined>) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20))
  const source = type === 'report' ? fixtures.reports : fixtures.essays
  const items = searchContents(source, query).map(publicSummary)
  return pageOf(items, page, pageSize)
}

export function getLocalContent(type: 'report' | 'essay', id: string): ContentDetail | null {
  const source = type === 'report' ? fixtures.reports : fixtures.essays
  const item = source.find((candidate) => candidate.id === id && candidate.status === 'published')
  return item ? publicDetail(item) : null
}

export function listLocalMembers(query: Record<string, string | undefined>) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(query.pageSize || '20', 10) || 20))
  const keyword = query.keyword?.trim().toLocaleLowerCase('zh-CN')
  const items = (fixtures.members as MemberSummary[])
    .filter((member) => !keyword || `${member.displayName} ${member.bio}`.toLocaleLowerCase('zh-CN').includes(keyword))
    .filter((member) => !query.platform || member.platforms.includes(query.platform as MemberSummary['platforms'][number]))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  return pageOf(items, page, pageSize)
}

export function getLocalMember(id: string): MemberDetail | null {
  const member = (fixtures.members as MemberDetail[]).find((candidate) => candidate.id === id)
  return member ?? null
}

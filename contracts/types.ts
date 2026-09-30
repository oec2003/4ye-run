export type ContentType = 'report' | 'essay'
export type ContentFormat = 'markdown' | 'image'
export type ContentStatus = 'published' | 'unpublished'
export type MemberStatus = 'published' | 'unpublished'
export type MemberPlatform = 'xiaoyuzhou' | 'xiaohongshu' | 'wechat_official' | 'website' | 'other'

export interface TextSpan {
  text: string
  bold?: boolean
  italic?: boolean
  href?: string
}

export type BodyBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; children: TextSpan[] }
  | { type: 'paragraph'; children: TextSpan[] }
  | { type: 'list'; ordered: boolean; items: TextSpan[][] }
  | { type: 'quote'; children: TextSpan[] }
  | { type: 'image'; assetId: string | null; sourceUrl: string | null; alt: string; caption?: string }
  | { type: 'divider' }

export interface ReportStats {
  totalDistanceKm: number | null
  participantCount: number | null
  participationCount: number | null
  activeDays: number | null
}

export interface Contributor {
  memberId: string | null
  displayName: string
  role: string
}

export interface Asset {
  id: string
  objectKey: string
  originalFilename: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes: number
  sha256: string
  width: number | null
  height: number | null
  publicUrl: string
  thumbnailUrl: string | null
  status: 'pending' | 'ready'
  createdAt: string
}

export interface ContentSummary {
  id: string
  type: ContentType
  title: string
  summary: string
  format: ContentFormat
  coverAssetId: string | null
  posterAssetId: string | null
  authorMemberId: string | null
  authorDisplayName: string
  contributors: Contributor[]
  tags: string[]
  periodStart: string | null
  periodEnd: string | null
  stats: ReportStats | null
  version: number
  publishedAt: string
  updatedAt: string
  coverUrl?: string | null
}

export interface ContentDetail extends ContentSummary {
  bodyMarkdown: string
  bodyBlocks: BodyBlock[]
  imageAssetIds: string[]
  contentHash: string
  assets: Record<string, Asset>
}

export interface MemberAccount {
  id: string
  memberId: string
  platform: MemberPlatform
  accountName: string
  accountId: string | null
  url: string | null
  description: string
  sortOrder: number
}

export interface MemberSummary {
  id: string
  displayName: string
  avatarAssetId: string | null
  avatarUrl?: string | null
  bio: string
  sortOrder: number
  version: number
  updatedAt: string
  platforms: MemberPlatform[]
}

export interface MemberDetail extends MemberSummary {
  accounts: MemberAccount[]
  recentContents: ContentSummary[]
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export interface ApiSuccess<T> {
  data: T
  meta?: PageMeta
  requestId: string
}

export interface ApiFailure {
  error: { code: string; message: string; details?: unknown }
  requestId: string
}

export interface ContentWrite {
  type: ContentType
  title: string
  summary: string
  format: ContentFormat
  bodyMarkdown: string
  coverAssetId: string | null
  posterAssetId: string | null
  imageAssetIds: string[]
  authorMemberId: string | null
  authorDisplayName: string
  contributors: Contributor[]
  tags: string[]
  periodStart: string | null
  periodEnd: string | null
  stats: ReportStats | null
  publishedAt: string
}

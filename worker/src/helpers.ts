import type { Asset, ContentDetail, ContentSummary, ContentWrite, Contributor, MemberAccount, MemberDetail, MemberPlatform, MemberSummary, ReportStats } from '../../contracts/types'
import { markdownToBodyBlocks } from '../../contracts/body-blocks'
import { validateContentWriteInput } from '../../contracts/validation'
import type { D1Database, D1PreparedStatement, D1Row, Env } from './cloudflare'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message) }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
}

export function success<T>(data: T, requestId: string, meta?: unknown, headers: HeadersInit = {}): Response {
  return json({ data, ...(meta ? { meta } : {}), requestId }, 200, headers)
}

export function failure(error: ApiError | Error, requestId: string): Response {
  const known = error instanceof ApiError
  return json({ error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : '服务暂时不可用。', ...(known && error.details !== undefined ? { details: error.details } : {}) }, requestId }, known ? error.status : 500, { 'cache-control': 'no-store' })
}

export function publicHeaders(): HeadersInit { return { 'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60' } }
export function adminHeaders(): HeadersInit { return { 'cache-control': 'no-store' } }

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('origin')
  if (!origin || !env.ALLOWED_WEB_ORIGIN || origin !== env.ALLOWED_WEB_ORIGIN) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,idempotency-key,x-request-id',
    'access-control-max-age': '86400',
    vary: 'origin'
  }
}

export async function requireAdmin(request: Request, env: Env): Promise<void> {
  const value = request.headers.get('authorization')
  if (!value?.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHORIZED', '缺少发布凭据。')
  const supplied = value.slice(7)
  const expected = env.PUBLISH_TOKEN || ''
  if (!expected) throw new ApiError(503, 'PUBLISH_TOKEN_NOT_CONFIGURED', '发布凭据尚未配置。')
  const encoder = new TextEncoder()
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ])
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean
  }
  if (!subtle.timingSafeEqual(suppliedHash, expectedHash)) throw new ApiError(403, 'FORBIDDEN', '发布凭据无效。')
}

export function requireUuid(value: string, field = 'id'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, 'VALIDATION_ERROR', `${field} 必须是 UUID。`)
  return value
}

export async function readJson<T>(request: Request): Promise<T> {
  const type = request.headers.get('content-type') || ''
  if (!type.toLowerCase().includes('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', '请求体必须是 application/json。')
  try { return await request.json() as T } catch { throw new ApiError(400, 'VALIDATION_ERROR', 'JSON 请求体无效。') }
}

export function parsePage(url: URL): { page: number; pageSize: number; offset: number } {
  const page = Number(url.searchParams.get('page') || '1')
  const pageSize = Number(url.searchParams.get('pageSize') || '20')
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new ApiError(400, 'VALIDATION_ERROR', 'page 必须从 1 开始，pageSize 必须在 1 到 50 之间。')
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

export async function rows<T = D1Row>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>()
  if (!result.success) throw new Error(result.error || 'D1 query failed')
  return result.results || []
}

export function contentSummary(row: D1Row): ContentSummary {
  return {
    id: String(row.id), type: String(row.type) as ContentSummary['type'], title: String(row.title), summary: String(row.summary), format: String(row.format) as ContentSummary['format'],
    coverAssetId: row.cover_asset_id ? String(row.cover_asset_id) : null, posterAssetId: row.poster_asset_id ? String(row.poster_asset_id) : null,
    authorMemberId: row.author_member_id ? String(row.author_member_id) : null, authorDisplayName: String(row.author_display_name || ''),
    contributors: parseJson<Contributor[]>(row.contributors_json, []), tags: parseJson<string[]>(row.tags_json, []),
    periodStart: row.period_start ? String(row.period_start) : null, periodEnd: row.period_end ? String(row.period_end) : null,
    stats: parseJson<ReportStats | null>(row.stats_json, null), version: Number(row.version), publishedAt: String(row.published_at), updatedAt: String(row.updated_at),
    coverUrl: row.cover_url ? String(row.cover_url) : null
  }
}

export function assetFromRow(row: D1Row): Asset {
  return { id: String(row.id), objectKey: String(row.object_key), originalFilename: String(row.original_filename), mimeType: String(row.mime_type) as Asset['mimeType'], sizeBytes: Number(row.size_bytes), sha256: String(row.sha256), width: row.width == null ? null : Number(row.width), height: row.height == null ? null : Number(row.height), publicUrl: String(row.public_url), thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null, status: String(row.status) as Asset['status'], createdAt: String(row.created_at) }
}

export async function assetsForContent(db: D1Database, contentId: string): Promise<Record<string, Asset>> {
  const result = await rows<D1Row>(db.prepare(`SELECT DISTINCT a.* FROM assets a WHERE a.status = 'ready' AND (a.id IN (SELECT asset_id FROM content_assets WHERE content_id = ?) OR a.id IN (SELECT cover_asset_id FROM contents WHERE id = ?) OR a.id IN (SELECT poster_asset_id FROM contents WHERE id = ?))`).bind(contentId, contentId, contentId))
  return Object.fromEntries(result.map((row) => [String(row.id), assetFromRow(row)]))
}

export async function contentDetail(db: D1Database, row: D1Row): Promise<ContentDetail> {
  const summary = contentSummary(row)
  const bodyMarkdown = String(row.body_markdown || '')
  return { ...summary, bodyMarkdown, bodyBlocks: markdownToBodyBlocks(bodyMarkdown).blocks, imageAssetIds: parseJson<string[]>(row.image_asset_ids_json, []), contentHash: String(row.content_hash), assets: await assetsForContent(db, summary.id) }
}

export function memberSummary(row: D1Row): MemberSummary {
  return { id: String(row.id), displayName: String(row.display_name), avatarAssetId: row.avatar_asset_id ? String(row.avatar_asset_id) : null, avatarUrl: row.avatar_url ? String(row.avatar_url) : null, bio: String(row.bio || ''), sortOrder: Number(row.sort_order), version: Number(row.version), updatedAt: String(row.updated_at), platforms: parseJson<MemberPlatform[]>(row.platforms_json, []) }
}

export function memberAccount(row: D1Row): MemberAccount {
  return { id: String(row.id), memberId: String(row.member_id), platform: String(row.platform) as MemberPlatform, accountName: String(row.account_name), accountId: row.account_id ? String(row.account_id) : null, url: row.url ? String(row.url) : null, description: String(row.description || ''), sortOrder: Number(row.sort_order) }
}

export async function memberDetail(db: D1Database, row: D1Row): Promise<MemberDetail> {
  const member = memberSummary(row)
  const accounts = (await rows<D1Row>(db.prepare('SELECT * FROM member_accounts WHERE member_id = ? ORDER BY sort_order, id').bind(member.id))).map(memberAccount)
  const recent = (await rows<D1Row>(db.prepare(`SELECT c.*, a.public_url AS cover_url, (SELECT json_group_array(json_object('memberId', co.member_id, 'displayName', co.display_name, 'role', co.role)) FROM contributors co WHERE co.content_id = c.id ORDER BY co.sort_order) AS contributors_json FROM contents c LEFT JOIN assets a ON a.id = c.cover_asset_id AND a.status = 'ready' WHERE c.status = 'published' AND c.author_member_id = ? ORDER BY c.published_at DESC, c.id DESC LIMIT 10`).bind(member.id))).map(contentSummary)
  return { ...member, accounts, recentContents: recent }
}

export function validateContentWrite(value: unknown): ContentWrite {
  const result = validateContentWriteInput(value)
  if (!result.ok) throw new ApiError(400, 'VALIDATION_ERROR', '内容字段校验失败。', result.errors)
  return result.data
}

export async function assertReadyAssets(db: D1Database, ids: string[]): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return
  const placeholders = unique.map(() => '?').join(',')
  const row = await db.prepare(`SELECT count(*) AS total FROM assets WHERE status = 'ready' AND id IN (${placeholders})`).bind(...unique).first<D1Row>()
  if (Number(row?.total || 0) !== unique.length) throw new ApiError(400, 'VALIDATION_ERROR', '存在尚未上传完成或不存在的素材。')
}

export function idempotencyKey(request: Request): string {
  const key = request.headers.get('idempotency-key')?.trim() || ''
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new ApiError(400, 'VALIDATION_ERROR', 'Idempotency-Key 必须为 8–128 位安全字符。')
  return key
}

export function extensionForMime(mime: string): string { return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp' }
export function validMime(mime: string): mime is Asset['mimeType'] { return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' }
export function detectedMime(bytes: Uint8Array): Asset['mimeType'] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

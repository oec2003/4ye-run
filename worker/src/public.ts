import type { D1Row, Env } from './cloudflare'
import { ApiError, contentDetail, contentSummary, memberDetail, memberSummary, parsePage, publicHeaders, rows, success } from './helpers'

const contentColumns = `c.*, a.public_url AS cover_url,
  (SELECT json_group_array(json_object('memberId', co.member_id, 'displayName', co.display_name, 'role', co.role))
   FROM contributors co WHERE co.content_id = c.id ORDER BY co.sort_order) AS contributors_json,
  (SELECT json_group_array(asset_id) FROM content_assets ca WHERE ca.content_id = c.id AND ca.role = 'body' ORDER BY ca.sort_order) AS image_asset_ids_json`

function escapeLike(value: string): string { return value.replace(/[\\%_]/g, '\\$&') }

export async function handlePublic(request: Request, env: Env, segments: string[], requestId: string): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'GET') throw new ApiError(404, 'NOT_FOUND', '接口不存在。')
  if (segments[0] === 'health' && segments.length === 1) return success({ status: 'ok', service: '4ye-run-api' }, requestId, undefined, { 'cache-control': 'no-store' })
  if (segments[0] === 'reports' || segments[0] === 'essays') {
    const type = segments[0] === 'reports' ? 'report' : 'essay'
    return segments.length === 1 ? listContents(env, type, url, requestId) : getContent(env, type, segments[1], requestId)
  }
  if (segments[0] === 'members') return segments.length === 1 ? listMembers(env, url, requestId) : getMember(env, segments[1], requestId)
  throw new ApiError(404, 'NOT_FOUND', '接口不存在。')
}

async function listContents(env: Env, type: 'report' | 'essay', url: URL, requestId: string): Promise<Response> {
  const { page, pageSize, offset } = parsePage(url)
  const where = [`c.type = ?`, `c.status = 'published'`]
  const values: unknown[] = [type]
  const keyword = url.searchParams.get('keyword')?.trim()
  if (keyword) {
    if (keyword.length > 80) throw new ApiError(400, 'VALIDATION_ERROR', 'keyword 最多 80 字。')
    where.push(`(c.title LIKE ? ESCAPE '\\' OR c.summary LIKE ? ESCAPE '\\' OR c.author_display_name LIKE ? ESCAPE '\\')`)
    const like = `%${escapeLike(keyword)}%`
    values.push(like, like, like)
  }
  const year = url.searchParams.get('year')
  if (year) {
    if (!/^\d{4}$/.test(year)) throw new ApiError(400, 'VALIDATION_ERROR', 'year 必须是四位年份。')
    where.push(`substr(c.published_at, 1, 4) = ?`)
    values.push(year)
  }
  const tag = url.searchParams.get('tag')?.trim()
  if (tag) {
    if (tag.length > 40) throw new ApiError(400, 'VALIDATION_ERROR', 'tag 最多 40 字。')
    where.push(`EXISTS (SELECT 1 FROM json_each(c.tags_json) WHERE value = ?)`)
    values.push(tag)
  }
  const clause = where.join(' AND ')
  const countRow = await env.DB.prepare(`SELECT count(*) AS total FROM contents c WHERE ${clause}`).bind(...values).first<D1Row>()
  const listRows = await rows<D1Row>(env.DB.prepare(`SELECT ${contentColumns} FROM contents c LEFT JOIN assets a ON a.id = c.cover_asset_id AND a.status = 'ready' WHERE ${clause} ORDER BY c.published_at DESC, c.id DESC LIMIT ? OFFSET ?`).bind(...values, pageSize, offset))
  const total = Number(countRow?.total || 0)
  return success(listRows.map(contentSummary), requestId, { page, pageSize, total, hasMore: offset + pageSize < total }, publicHeaders())
}

async function getContent(env: Env, type: 'report' | 'essay', id: string, requestId: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT ${contentColumns} FROM contents c LEFT JOIN assets a ON a.id = c.cover_asset_id AND a.status = 'ready' WHERE c.id = ? AND c.type = ? AND c.status = 'published'`).bind(id, type).first<D1Row>()
  if (!row) throw new ApiError(404, 'NOT_FOUND', type === 'report' ? '未找到这期周报。' : '未找到这篇小作文。')
  return success(await contentDetail(env.DB, row), requestId, undefined, publicHeaders())
}

async function listMembers(env: Env, url: URL, requestId: string): Promise<Response> {
  const { page, pageSize, offset } = parsePage(url)
  const where = [`m.status = 'published'`]
  const values: unknown[] = []
  const keyword = url.searchParams.get('keyword')?.trim()
  if (keyword) {
    if (keyword.length > 80) throw new ApiError(400, 'VALIDATION_ERROR', 'keyword 最多 80 字。')
    const like = `%${escapeLike(keyword)}%`
    where.push(`(m.display_name LIKE ? ESCAPE '\\' OR m.bio LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM member_accounts ma WHERE ma.member_id = m.id AND (ma.account_name LIKE ? ESCAPE '\\' OR ma.account_id LIKE ? ESCAPE '\\')))`)
    values.push(like, like, like, like)
  }
  const platform = url.searchParams.get('platform')
  if (platform) {
    if (!['xiaoyuzhou', 'xiaohongshu', 'wechat_official', 'website', 'other'].includes(platform)) throw new ApiError(400, 'VALIDATION_ERROR', 'platform 无效。')
    where.push(`EXISTS (SELECT 1 FROM member_accounts ma WHERE ma.member_id = m.id AND ma.platform = ?)`)
    values.push(platform)
  }
  const clause = where.join(' AND ')
  const countRow = await env.DB.prepare(`SELECT count(*) AS total FROM members m WHERE ${clause}`).bind(...values).first<D1Row>()
  const listRows = await rows<D1Row>(env.DB.prepare(`SELECT m.*, a.public_url AS avatar_url, (SELECT json_group_array(DISTINCT platform) FROM member_accounts ma WHERE ma.member_id = m.id) AS platforms_json FROM members m LEFT JOIN assets a ON a.id = m.avatar_asset_id AND a.status = 'ready' WHERE ${clause} ORDER BY m.sort_order, m.id LIMIT ? OFFSET ?`).bind(...values, pageSize, offset))
  const total = Number(countRow?.total || 0)
  return success(listRows.map(memberSummary), requestId, { page, pageSize, total, hasMore: offset + pageSize < total }, publicHeaders())
}

async function getMember(env: Env, id: string, requestId: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT m.*, a.public_url AS avatar_url, (SELECT json_group_array(DISTINCT platform) FROM member_accounts ma WHERE ma.member_id = m.id) AS platforms_json FROM members m LEFT JOIN assets a ON a.id = m.avatar_asset_id AND a.status = 'ready' WHERE m.id = ? AND m.status = 'published'`).bind(id).first<D1Row>()
  if (!row) throw new ApiError(404, 'NOT_FOUND', '未找到这位跑友。')
  return success(await memberDetail(env.DB, row), requestId, undefined, publicHeaders())
}

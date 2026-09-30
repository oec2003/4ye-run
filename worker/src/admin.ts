import { isSafeExternalUrl, markdownToBodyBlocks } from '../../contracts/body-blocks'
import { sha256Hex } from '../../contracts/hash'
import type { ContentDetail, ContentWrite, MemberAccount, MemberPlatform } from '../../contracts/types'
import type { D1PreparedStatement, D1Row, Env } from './cloudflare'
import { adminHeaders, ApiError, assertReadyAssets, contentDetail, contentSummary, detectedMime, extensionForMime, idempotencyKey, json, memberAccount, memberDetail, memberSummary, parseJson, readJson, requireUuid, rows, success, validMime, validateContentWrite } from './helpers'

const adminContentColumns = `c.*, a.public_url AS cover_url,
  (SELECT json_group_array(json_object('memberId', co.member_id, 'displayName', co.display_name, 'role', co.role)) FROM contributors co WHERE co.content_id = c.id ORDER BY co.sort_order) AS contributors_json,
  (SELECT json_group_array(asset_id) FROM content_assets ca WHERE ca.content_id = c.id AND ca.role = 'body' ORDER BY ca.sort_order) AS image_asset_ids_json`

interface IdempotencyRow extends D1Row { request_hash: string; response_json: string }

async function priorResponse(env: Env, key: string, requestHash: string): Promise<Response | null> {
  const prior = await env.DB.prepare('SELECT request_hash, response_json FROM idempotency_records WHERE idempotency_key = ?').bind(key).first<IdempotencyRow>()
  if (!prior) return null
  if (String(prior.request_hash) !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '同一个 Idempotency-Key 已用于不同请求。')
  return json(JSON.parse(String(prior.response_json)), 200, adminHeaders())
}

async function conflict(env: Env, table: 'contents' | 'members', id: string): Promise<never> {
  const current = await env.DB.prepare(`SELECT version FROM ${table} WHERE id = ?`).bind(id).first<D1Row>()
  throw new ApiError(409, 'VERSION_CONFLICT', '版本已变化，请重新读取后再发布。', { currentVersion: current ? Number(current.version) : 0 })
}

export async function handleAdmin(request: Request, env: Env, segments: string[], requestId: string): Promise<Response> {
  if (segments[1] === 'contents') return handleContents(request, env, segments.slice(2), requestId)
  if (segments[1] === 'members') return handleMembers(request, env, segments.slice(2), requestId)
  if (segments[1] === 'assets') return handleAssets(request, env, segments.slice(2), requestId)
  throw new ApiError(404, 'NOT_FOUND', '管理接口不存在。')
}

async function handleContents(request: Request, env: Env, path: string[], requestId: string): Promise<Response> {
  if (!path.length && request.method === 'GET') {
    const result = await rows<D1Row>(env.DB.prepare(`SELECT ${adminContentColumns} FROM contents c LEFT JOIN assets a ON a.id = c.cover_asset_id ORDER BY c.updated_at DESC, c.id DESC LIMIT 50`))
    return success(result.map((row) => ({ ...contentSummary(row), status: row.status })), requestId, undefined, adminHeaders())
  }
  const id = requireUuid(path[0] || '')
  if (path.length === 1 && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT ${adminContentColumns} FROM contents c LEFT JOIN assets a ON a.id = c.cover_asset_id WHERE c.id = ?`).bind(id).first<D1Row>()
    if (!row) throw new ApiError(404, 'NOT_FOUND', '内容不存在。')
    return success({ ...(await contentDetail(env.DB, row)), status: row.status }, requestId, undefined, adminHeaders())
  }
  if (path[1] === 'publish' && request.method === 'POST') {
    const body = await readJson<{ expectedVersion: number; content: unknown }>(request)
    return executeContentPublish(request, env, id, body.expectedVersion, validateContentWrite(body.content), requestId, 'publish')
  }
  if (path[1] === 'unpublish' && request.method === 'POST') return unpublishContent(request, env, id, requestId)
  if (path[1] === 'revisions' && request.method === 'GET') {
    if (path.length === 2) {
      const revisions = await rows<D1Row>(env.DB.prepare(`SELECT entity_id, version, content_hash, operator, created_at FROM revisions WHERE entity_type = 'content' AND entity_id = ? ORDER BY version DESC LIMIT 100`).bind(id))
      return success(revisions.map((row) => ({ entityId: row.entity_id, version: Number(row.version), contentHash: row.content_hash, operator: row.operator, createdAt: row.created_at })), requestId, undefined, adminHeaders())
    }
    const revision = await env.DB.prepare(`SELECT * FROM revisions WHERE entity_type = 'content' AND entity_id = ? AND version = ?`).bind(id, Number(path[2])).first<D1Row>()
    if (!revision) throw new ApiError(404, 'NOT_FOUND', '历史版本不存在。')
    return success(JSON.parse(String(revision.snapshot_json)), requestId, undefined, adminHeaders())
  }
  if (path[1] === 'restore' && request.method === 'POST') {
    const body = await readJson<{ expectedVersion: number; revisionVersion: number }>(request)
    if (!Number.isInteger(body.revisionVersion) || body.revisionVersion < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'revisionVersion 无效。')
    const revision = await env.DB.prepare(`SELECT snapshot_json FROM revisions WHERE entity_type = 'content' AND entity_id = ? AND version = ?`).bind(id, body.revisionVersion).first<D1Row>()
    if (!revision) throw new ApiError(404, 'NOT_FOUND', '历史版本不存在。')
    const snapshot = JSON.parse(String(revision.snapshot_json)) as ContentDetail
    const content: ContentWrite = validateContentWrite({ type: snapshot.type, title: snapshot.title, summary: snapshot.summary, format: snapshot.format, bodyMarkdown: snapshot.bodyMarkdown, coverAssetId: snapshot.coverAssetId, posterAssetId: snapshot.posterAssetId, imageAssetIds: snapshot.imageAssetIds, authorMemberId: snapshot.authorMemberId, authorDisplayName: snapshot.authorDisplayName, contributors: snapshot.contributors, tags: snapshot.tags, periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd, stats: snapshot.stats, publishedAt: snapshot.publishedAt })
    return executeContentPublish(request, env, id, body.expectedVersion, content, requestId, `restore:${body.revisionVersion}`)
  }
  throw new ApiError(404, 'NOT_FOUND', '管理接口不存在。')
}

async function executeContentPublish(request: Request, env: Env, id: string, expectedVersion: number, content: ContentWrite, requestId: string, operation: string): Promise<Response> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new ApiError(400, 'VALIDATION_ERROR', 'expectedVersion 必须是非负整数。')
  const key = idempotencyKey(request)
  const requestHash = await sha256Hex({ operation, id, expectedVersion, content })
  const prior = await priorResponse(env, key, requestHash)
  if (prior) return prior
  const assetIds = [content.coverAssetId, content.posterAssetId, ...content.imageAssetIds].filter(Boolean) as string[]
  await assertReadyAssets(env.DB, assetIds)
  const now = new Date().toISOString()
  const nextVersion = expectedVersion + 1
  const contentHash = await sha256Hex(content)
  const published = { ...content, id, status: 'published' as const, version: nextVersion, contentHash, updatedAt: now, bodyBlocks: markdownToBodyBlocks(content.bodyMarkdown).blocks, assets: {} }
  const envelope = { data: published, requestId }
  const statements: D1PreparedStatement[] = []
  statements.push(env.DB.prepare(`INSERT INTO contents (id,type,title,summary,format,body_markdown,cover_asset_id,poster_asset_id,author_member_id,author_display_name,tags_json,period_start,period_end,stats_json,status,version,content_hash,published_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',1,?,?,? WHERE ? = 0
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,format=excluded.format,body_markdown=excluded.body_markdown,cover_asset_id=excluded.cover_asset_id,poster_asset_id=excluded.poster_asset_id,author_member_id=excluded.author_member_id,author_display_name=excluded.author_display_name,tags_json=excluded.tags_json,period_start=excluded.period_start,period_end=excluded.period_end,stats_json=excluded.stats_json,status='published',version=contents.version+1,content_hash=excluded.content_hash,published_at=excluded.published_at,updated_at=excluded.updated_at
    WHERE contents.version = ? AND contents.type = excluded.type RETURNING version`).bind(id, content.type, content.title.trim(), content.summary.trim(), content.format, content.bodyMarkdown, content.coverAssetId, content.posterAssetId, content.authorMemberId, content.authorDisplayName, JSON.stringify(content.tags), content.periodStart, content.periodEnd, content.stats ? JSON.stringify(content.stats) : null, contentHash, content.publishedAt, now, expectedVersion, expectedVersion))
  statements.push(env.DB.prepare(`DELETE FROM contributors WHERE content_id = ? AND EXISTS (SELECT 1 FROM contents WHERE id = ? AND version = ?)`).bind(id, id, nextVersion))
  content.contributors.forEach((item, index) => statements.push(env.DB.prepare(`INSERT INTO contributors (content_id,member_id,display_name,role,sort_order) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM contents WHERE id = ? AND version = ?)`).bind(id, item.memberId, item.displayName, item.role, index, id, nextVersion)))
  statements.push(env.DB.prepare(`DELETE FROM content_assets WHERE content_id = ? AND EXISTS (SELECT 1 FROM contents WHERE id = ? AND version = ?)`).bind(id, id, nextVersion))
  const associations: Array<[string, 'cover' | 'poster' | 'body', number]> = []
  if (content.coverAssetId) associations.push([content.coverAssetId, 'cover', 0])
  if (content.posterAssetId) associations.push([content.posterAssetId, 'poster', 0])
  content.imageAssetIds.forEach((assetId, index) => associations.push([assetId, 'body', index]))
  associations.forEach(([assetId, role, order]) => statements.push(env.DB.prepare(`INSERT INTO content_assets (content_id,asset_id,role,sort_order) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM contents WHERE id = ? AND version = ?)`).bind(id, assetId, role, order, id, nextVersion)))
  statements.push(env.DB.prepare(`INSERT INTO revisions (entity_type,entity_id,version,snapshot_json,content_hash,operator,created_at) SELECT 'content',?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM contents WHERE id = ? AND version = ?)`).bind(id, nextVersion, JSON.stringify(published), contentHash, 'obsidian-publisher', now, id, nextVersion))
  statements.push(env.DB.prepare(`INSERT INTO idempotency_records (idempotency_key,operation,request_hash,response_json,entity_id,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM contents WHERE id = ? AND version = ?)`).bind(key, operation, requestHash, JSON.stringify(envelope), id, now, id, nextVersion))
  try {
    const results = await env.DB.batch(statements)
    const applied = results[0]?.results?.[0] as { version?: number } | undefined
    if (!applied || Number(applied.version) !== nextVersion) await conflict(env, 'contents', id)
  } catch (error) {
    const raced = await priorResponse(env, key, requestHash)
    if (raced) return raced
    if (error instanceof ApiError) throw error
    throw error
  }
  return json(envelope, 200, adminHeaders())
}

async function unpublishContent(request: Request, env: Env, id: string, requestId: string): Promise<Response> {
  const body = await readJson<{ expectedVersion: number }>(request)
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'expectedVersion 无效。')
  const key = idempotencyKey(request)
  const requestHash = await sha256Hex({ operation: 'unpublish', id, ...body })
  const prior = await priorResponse(env, key, requestHash)
  if (prior) return prior
  const current = await env.DB.prepare(`SELECT ${adminContentColumns} FROM contents c LEFT JOIN assets a ON a.id = c.cover_asset_id WHERE c.id = ?`).bind(id).first<D1Row>()
  if (!current) throw new ApiError(404, 'NOT_FOUND', '内容不存在。')
  const nextVersion = body.expectedVersion + 1
  const now = new Date().toISOString()
  const snapshot = { ...(await contentDetail(env.DB, current)), status: 'unpublished', version: nextVersion, updatedAt: now }
  const envelope = { data: { id, status: 'unpublished', version: nextVersion, updatedAt: now }, requestId }
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE contents SET status='unpublished',version=version+1,updated_at=? WHERE id=? AND version=? RETURNING version`).bind(now, id, body.expectedVersion),
    env.DB.prepare(`INSERT INTO revisions (entity_type,entity_id,version,snapshot_json,content_hash,operator,created_at) SELECT 'content',?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM contents WHERE id=? AND version=?)`).bind(id, nextVersion, JSON.stringify(snapshot), String(current.content_hash), 'obsidian-publisher', now, id, nextVersion),
    env.DB.prepare(`INSERT INTO idempotency_records (idempotency_key,operation,request_hash,response_json,entity_id,created_at) SELECT ?,'unpublish',?,?,?,? WHERE EXISTS (SELECT 1 FROM contents WHERE id=? AND version=?)`).bind(key, requestHash, JSON.stringify(envelope), id, now, id, nextVersion)
  ])
  if (!results[0]?.results?.length) await conflict(env, 'contents', id)
  return json(envelope, 200, adminHeaders())
}

interface MemberWriteBody {
  expectedVersion: number
  member: { displayName: string; avatarAssetId: string | null; bio: string; sortOrder: number }
  accounts: Array<{ id: string; platform: MemberPlatform; accountName: string; accountId: string | null; url: string | null; description: string; sortOrder: number }>
}

async function handleMembers(request: Request, env: Env, path: string[], requestId: string): Promise<Response> {
  if (!path.length && request.method === 'GET') {
    const list = await rows<D1Row>(env.DB.prepare(`SELECT m.*, a.public_url AS avatar_url, (SELECT json_group_array(DISTINCT platform) FROM member_accounts ma WHERE ma.member_id=m.id) AS platforms_json FROM members m LEFT JOIN assets a ON a.id=m.avatar_asset_id ORDER BY m.sort_order,m.id LIMIT 100`))
    return success(list.map((row) => ({ ...memberSummary(row), status: row.status })), requestId, undefined, adminHeaders())
  }
  const id = requireUuid(path[0] || '')
  if (path.length === 1 && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT m.*, a.public_url AS avatar_url, (SELECT json_group_array(DISTINCT platform) FROM member_accounts ma WHERE ma.member_id=m.id) AS platforms_json FROM members m LEFT JOIN assets a ON a.id=m.avatar_asset_id WHERE m.id=?`).bind(id).first<D1Row>()
    if (!row) throw new ApiError(404, 'NOT_FOUND', '跑友资料不存在。')
    return success({ ...(await memberDetail(env.DB, row)), status: row.status }, requestId, undefined, adminHeaders())
  }
  if (path[1] === 'publish' && request.method === 'POST') return publishMember(request, env, id, requestId)
  if (path[1] === 'unpublish' && request.method === 'POST') return unpublishMember(request, env, id, requestId)
  throw new ApiError(404, 'NOT_FOUND', '管理接口不存在。')
}

async function publishMember(request: Request, env: Env, id: string, requestId: string): Promise<Response> {
  const body = await readJson<MemberWriteBody>(request)
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0 || !body.member || !Array.isArray(body.accounts)) throw new ApiError(400, 'VALIDATION_ERROR', '名片发布请求无效。')
  if (!body.member.displayName?.trim() || body.member.displayName.length > 80 || typeof body.member.bio !== 'string' || !Number.isInteger(body.member.sortOrder)) throw new ApiError(400, 'VALIDATION_ERROR', '名片字段无效。')
  if (body.member.avatarAssetId) { requireUuid(body.member.avatarAssetId, 'avatarAssetId'); await assertReadyAssets(env.DB, [body.member.avatarAssetId]) }
  const platforms: MemberPlatform[] = ['xiaoyuzhou', 'xiaohongshu', 'wechat_official', 'website', 'other']
  body.accounts.forEach((account) => {
    requireUuid(account.id, 'accounts[].id')
    if (!platforms.includes(account.platform) || !account.accountName?.trim() || !Number.isInteger(account.sortOrder)) throw new ApiError(400, 'VALIDATION_ERROR', '账号字段无效。')
    if (account.url && !isSafeExternalUrl(account.url)) throw new ApiError(400, 'VALIDATION_ERROR', '账号链接只允许 http/https。')
  })
  const key = idempotencyKey(request)
  const requestHash = await sha256Hex({ operation: 'member-publish', id, body })
  const prior = await priorResponse(env, key, requestHash)
  if (prior) return prior
  const now = new Date().toISOString(), nextVersion = body.expectedVersion + 1, contentHash = await sha256Hex({ member: body.member, accounts: body.accounts })
  const data = { id, ...body.member, accounts: body.accounts.map((account) => ({ ...account, memberId: id })), status: 'published', version: nextVersion, contentHash, updatedAt: now }
  const envelope = { data, requestId }
  const statements: D1PreparedStatement[] = [env.DB.prepare(`INSERT INTO members (id,display_name,avatar_asset_id,bio,sort_order,status,version,content_hash,updated_at) SELECT ?,?,?,?,?,'published',1,?,? WHERE ?=0 ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,avatar_asset_id=excluded.avatar_asset_id,bio=excluded.bio,sort_order=excluded.sort_order,status='published',version=members.version+1,content_hash=excluded.content_hash,updated_at=excluded.updated_at WHERE members.version=? RETURNING version`).bind(id, body.member.displayName.trim(), body.member.avatarAssetId, body.member.bio, body.member.sortOrder, contentHash, now, body.expectedVersion, body.expectedVersion)]
  statements.push(env.DB.prepare(`DELETE FROM member_accounts WHERE member_id=? AND EXISTS (SELECT 1 FROM members WHERE id=? AND version=?)`).bind(id, id, nextVersion))
  body.accounts.forEach((account) => statements.push(env.DB.prepare(`INSERT INTO member_accounts (id,member_id,platform,account_name,account_id,url,description,sort_order) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM members WHERE id=? AND version=?)`).bind(account.id, id, account.platform, account.accountName.trim(), account.accountId, account.url, account.description || '', account.sortOrder, id, nextVersion)))
  statements.push(env.DB.prepare(`INSERT INTO revisions (entity_type,entity_id,version,snapshot_json,content_hash,operator,created_at) SELECT 'member',?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM members WHERE id=? AND version=?)`).bind(id, nextVersion, JSON.stringify(data), contentHash, 'obsidian-publisher', now, id, nextVersion))
  statements.push(env.DB.prepare(`INSERT INTO idempotency_records (idempotency_key,operation,request_hash,response_json,entity_id,created_at) SELECT ?,'member-publish',?,?,?,? WHERE EXISTS (SELECT 1 FROM members WHERE id=? AND version=?)`).bind(key, requestHash, JSON.stringify(envelope), id, now, id, nextVersion))
  const results = await env.DB.batch(statements)
  if (!results[0]?.results?.length) await conflict(env, 'members', id)
  return json(envelope, 200, adminHeaders())
}

async function unpublishMember(request: Request, env: Env, id: string, requestId: string): Promise<Response> {
  const body = await readJson<{ expectedVersion: number }>(request)
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'expectedVersion 无效。')
  const key = idempotencyKey(request), requestHash = await sha256Hex({ operation: 'member-unpublish', id, body }), now = new Date().toISOString(), nextVersion = body.expectedVersion + 1
  const prior = await priorResponse(env, key, requestHash); if (prior) return prior
  const envelope = { data: { id, status: 'unpublished', version: nextVersion, updatedAt: now }, requestId }
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE members SET status='unpublished',version=version+1,updated_at=? WHERE id=? AND version=? RETURNING version`).bind(now, id, body.expectedVersion),
    env.DB.prepare(`INSERT INTO revisions (entity_type,entity_id,version,snapshot_json,content_hash,operator,created_at) SELECT 'member',id,version,json_object('id',id,'status',status,'version',version,'updatedAt',updated_at),content_hash,'obsidian-publisher',? FROM members WHERE id=? AND version=?`).bind(now, id, nextVersion),
    env.DB.prepare(`INSERT INTO idempotency_records (idempotency_key,operation,request_hash,response_json,entity_id,created_at) SELECT ?,'member-unpublish',?,?,?,? WHERE EXISTS (SELECT 1 FROM members WHERE id=? AND version=?)`).bind(key, requestHash, JSON.stringify(envelope), id, now, id, nextVersion)
  ])
  if (!results[0]?.results?.length) await conflict(env, 'members', id)
  return json(envelope, 200, adminHeaders())
}

async function handleAssets(request: Request, env: Env, path: string[], requestId: string): Promise<Response> {
  const maxSize = Math.min(15 * 1024 * 1024, Number(env.MAX_ASSET_SIZE_BYTES || 15 * 1024 * 1024))
  if (path[0] === 'init' && request.method === 'POST') {
    const body = await readJson<{ filename: string; mimeType: string; sizeBytes: number; sha256: string; width?: number; height?: number }>(request)
    if (!validMime(body.mimeType)) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', '只支持 JPEG、PNG 和 WebP。')
    if (!Number.isInteger(body.sizeBytes) || body.sizeBytes < 1) throw new ApiError(400, 'VALIDATION_ERROR', 'sizeBytes 无效。')
    if (body.sizeBytes > maxSize) throw new ApiError(413, 'FILE_TOO_LARGE', `图片不能超过 ${Math.floor(maxSize / 1024 / 1024)} MiB。`)
    if (!/^[0-9a-f]{64}$/i.test(body.sha256)) throw new ApiError(400, 'VALIDATION_ERROR', 'sha256 必须是 64 位十六进制。')
    const existing = await env.DB.prepare(`SELECT * FROM assets WHERE sha256=? AND status='ready'`).bind(body.sha256.toLowerCase()).first<D1Row>()
    if (existing) return success({ assetId: existing.id, reused: true, uploadRequired: false, publicUrl: existing.public_url }, requestId, undefined, adminHeaders())
    const id = crypto.randomUUID(), extension = extensionForMime(body.mimeType), objectKey = `assets/${body.sha256.toLowerCase()}.${extension}`, base = env.ASSET_PUBLIC_BASE_URL.replace(/\/$/, ''), publicUrl = `${base}/${objectKey}`, now = new Date().toISOString()
    const filename = String(body.filename || 'image').replace(/[\\/\0-\x1f]/g, '_').slice(0, 180)
    await env.DB.prepare(`INSERT INTO assets (id,object_key,original_filename,mime_type,size_bytes,sha256,width,height,public_url,thumbnail_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,NULL,'pending',?)`).bind(id, objectKey, filename, body.mimeType, body.sizeBytes, body.sha256.toLowerCase(), Number.isInteger(body.width) ? body.width : null, Number.isInteger(body.height) ? body.height : null, publicUrl, now).run()
    return success({ assetId: id, reused: false, uploadRequired: true, upload: { method: 'PUT', path: `/api/v1/admin/assets/${id}/content`, maxSizeBytes: maxSize } }, requestId, undefined, adminHeaders())
  }
  const id = requireUuid(path[0] || '')
  if (path[1] === 'content' && request.method === 'PUT') {
    const asset = await env.DB.prepare('SELECT * FROM assets WHERE id=?').bind(id).first<D1Row>()
    if (!asset) throw new ApiError(404, 'NOT_FOUND', '素材不存在。')
    if (asset.status === 'ready') return success({ assetId: id, reused: true, publicUrl: asset.public_url }, requestId, undefined, adminHeaders())
    const buffer = await request.arrayBuffer()
    if (buffer.byteLength > maxSize || buffer.byteLength !== Number(asset.size_bytes)) throw new ApiError(buffer.byteLength > maxSize ? 413 : 400, buffer.byteLength > maxSize ? 'FILE_TOO_LARGE' : 'VALIDATION_ERROR', '上传文件大小与初始化信息不一致。')
    const mime = detectedMime(new Uint8Array(buffer.slice(0, 16)))
    if (!mime || mime !== asset.mime_type) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', '文件真实类型与声明不一致。')
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), (byte) => byte.toString(16).padStart(2, '0')).join('')
    if (digest !== asset.sha256) throw new ApiError(400, 'VALIDATION_ERROR', '文件 sha256 校验失败。')
    await env.ASSETS.put(String(asset.object_key), buffer, { httpMetadata: { contentType: mime }, customMetadata: { sha256: digest, assetId: id } })
    const result = await env.DB.prepare(`UPDATE assets SET status='ready' WHERE id=? AND status='pending'`).bind(id).run()
    if (!result.success) throw new Error('asset metadata update failed')
    return success({ assetId: id, reused: false, publicUrl: asset.public_url }, requestId, undefined, adminHeaders())
  }
  throw new ApiError(404, 'NOT_FOUND', '素材接口不存在。')
}

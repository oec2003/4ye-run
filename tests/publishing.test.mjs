import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

let mf
before(async () => {
  const compiled = await build({ entryPoints: ['worker/src/index.ts'], bundle: true, format: 'esm', platform: 'browser', write: false })
  mf = new Miniflare(convertV4MiniflareOptions({
    script: compiled.outputFiles[0].text, modules: true, compatibilityDate: '2026-09-30', compatibilityFlags: ['nodejs_compat'],
    cf: false, d1Databases: ['DB'], r2Buckets: ['ASSETS'],
    bindings: { PUBLISH_TOKEN: 'isolated-publishing-test', ASSET_PUBLIC_BASE_URL: 'https://images.example.test', MAX_ASSET_SIZE_BYTES: String(15 * 1024 * 1024) }
  }))
  const migration = await readFile('worker/migrations/0001_initial.sql', 'utf8')
  await (await mf.getD1Database('DB')).exec(migration.replace(/\s+/g, ' '))
})
after(async () => { await mf?.dispose() })

const write = (title = '发布测试', overrides = {}) => ({
  type: 'report', title, summary: '', format: 'markdown', bodyMarkdown: '## 正文\n\n测试。', coverAssetId: null, posterAssetId: null, imageAssetIds: [],
  authorMemberId: null, authorDisplayName: '测试编辑', contributors: [{ memberId: null, displayName: title, role: '编辑' }], tags: [], periodStart: null, periodEnd: null,
  stats: null, publishedAt: '2026-09-30T00:00:00+08:00', ...overrides
})
async function request(path, body, key = crypto.randomUUID()) {
  const response = await mf.dispatchFetch(`http://localhost/api/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer isolated-publishing-test', 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return { status: response.status, body: await response.json() }
}
test('D1 CAS: one of concurrent creates wins; loser cannot rewrite associations or revisions', async () => {
  const id = crypto.randomUUID()
  const result = await Promise.all(['甲', '乙'].map(title => request(`/admin/contents/${id}/publish`, { expectedVersion: 0, content: write(title) })))
  assert.deepEqual(result.map(r => r.status).sort(), [200, 409])
  const winner = result.find(r => r.status === 200).body.data
  const stored = (await request(`/admin/contents/${id}`)).body.data
  assert.equal(stored.title, winner.title); assert.equal(stored.contributors[0].displayName, winner.title); assert.equal(stored.version, 1)
  assert.equal((await request(`/admin/contents/${id}/revisions`)).body.data.length, 1)
})
test('concurrent identical idempotency keys replay original result, and changed payload conflicts', async () => {
  const id = crypto.randomUUID(), key = crypto.randomUUID(), body = { expectedVersion: 0, content: write('幂等') }
  const result = await Promise.all([request(`/admin/contents/${id}/publish`, body, key), request(`/admin/contents/${id}/publish`, body, key)])
  assert.ok(result.every(r => r.status === 200)); assert.deepEqual(result[0].body, result[1].body)
  const changed = await request(`/admin/contents/${id}/publish`, { ...body, content: write('不同正文') }, key)
  assert.equal(changed.status, 409); assert.equal(changed.body.error.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal((await request(`/admin/contents/${id}`)).body.data.version, 1)
})
test('updates with exact version succeed; stale/nonexistent nonzero versions do not alter snapshots', async () => {
  const id = crypto.randomUUID()
  assert.equal((await request(`/admin/contents/${id}/publish`, { expectedVersion: 0, content: write('v1') })).status, 200)
  const second = await request(`/admin/contents/${id}/publish`, { expectedVersion: 1, content: write('v2') })
  assert.equal(second.status, 200); assert.equal(second.body.data.version, 2)
  assert.equal((await request(`/admin/contents/${id}/publish`, { expectedVersion: 1, content: write('不能覆盖') })).status, 409)
  const stored = (await request(`/admin/contents/${id}`)).body.data
  assert.equal(stored.title, 'v2'); assert.equal(stored.contributors[0].displayName, 'v2')
  const absent = crypto.randomUUID()
  assert.equal((await request(`/admin/contents/${absent}/publish`, { expectedVersion: 4, content: write() })).status, 409)
  assert.equal((await request(`/admin/contents/${absent}`)).status, 404)
})
test('unpublish and restore are idempotent, atomic and monotonically versioned', async () => {
  const id = crypto.randomUUID(), key = crypto.randomUUID()
  await request(`/admin/contents/${id}/publish`, { expectedVersion: 0, content: write('恢复原始') })
  await request(`/admin/contents/${id}/publish`, { expectedVersion: 1, content: write('更新版本') })
  const down = await Promise.all([request(`/admin/contents/${id}/unpublish`, { expectedVersion: 2 }, key), request(`/admin/contents/${id}/unpublish`, { expectedVersion: 2 }, key)])
  assert.ok(down.every(r => r.status === 200)); assert.deepEqual(down[0].body, down[1].body); assert.equal(down[0].body.data.version, 3)
  assert.equal((await request(`/reports/${id}`)).status, 404)
  const restoreKey = crypto.randomUUID(), restore = { expectedVersion: 3, revisionVersion: 1 }
  const revived = await request(`/admin/contents/${id}/restore`, restore, restoreKey)
  assert.equal(revived.status, 200); assert.equal(revived.body.data.version, 4); assert.equal(revived.body.data.title, '恢复原始')
  assert.deepEqual((await request(`/admin/contents/${id}/restore`, restore, restoreKey)).body, revived.body)
  assert.equal((await request(`/admin/contents/${id}/unpublish`, { expectedVersion: 2 })).status, 409)
  assert.equal((await request(`/admin/contents/${id}`)).body.data.version, 4)
})
test('pending asset init resumes one immutable object; uploaded ready assets hydrate history', async () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJpUAAAAASUVORK5CYII=', 'base64')
  const metadata = { filename: '中文 图片.png', mimeType: 'image/png', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), width: 1, height: 1 }
  const initialized = await Promise.all([request('/admin/assets/init', metadata), request('/admin/assets/init', metadata)])
  assert.ok(initialized.every(r => r.status === 200)); const assetId = initialized[0].body.data.assetId
  assert.equal(initialized[1].body.data.assetId, assetId)
  const uploaded = await mf.dispatchFetch(`http://localhost/api/v1/admin/assets/${assetId}/content`, { method: 'PUT', headers: { Authorization: 'Bearer isolated-publishing-test', 'Content-Type': 'image/png' }, body: bytes })
  assert.equal(uploaded.status, 200); assert.equal((await request('/admin/assets/init', metadata)).body.data.uploadRequired, false)
  const id = crypto.randomUUID(), content = write('含图', { imageAssetIds: [assetId], posterAssetId: assetId, bodyMarkdown: `![正文](asset://${assetId})` })
  await request(`/admin/contents/${id}/publish`, { expectedVersion: 0, content })
  await request(`/admin/contents/${id}/publish`, { expectedVersion: 1, content: write('删除图的新版') })
  const historical = (await request(`/admin/contents/${id}/revisions/1`)).body.data
  assert.equal(historical.assets[assetId].sha256, metadata.sha256); assert.equal(historical.bodyBlocks[0].assetId, assetId)
})
test('foreign-key failure rolls back parent write, version and idempotency receipt together', async () => {
  const id = crypto.randomUUID(), key = crypto.randomUUID()
  const failed = await request(`/admin/contents/${id}/publish`, { expectedVersion: 0, content: write('非法关联', { contributors: [{ memberId: crypto.randomUUID(), displayName: '不存在跑友', role: '作者' }] }) }, key)
  assert.equal(failed.status, 500); assert.equal((await request(`/admin/contents/${id}`)).status, 404)
  assert.equal((await request(`/admin/contents/${id}/publish`, { expectedVersion: 0, content: write('修正后') }, key)).status, 200)
})
test('member update and concurrent replay retain consistent accounts and contentHash', async () => {
  const id = crypto.randomUUID(), account = { id: crypto.randomUUID(), platform: 'website', accountName: '网站', accountId: null, url: 'https://example.com', description: '', sortOrder: 0 }
  const original = { expectedVersion: 0, member: { displayName: '本地测试跑友', avatarAssetId: null, bio: '', sortOrder: 0 }, accounts: [account] }
  const key = crypto.randomUUID(), creation = await Promise.all([request(`/admin/members/${id}/publish`, original, key), request(`/admin/members/${id}/publish`, original, key)])
  assert.ok(creation.every(r => r.status === 200)); assert.deepEqual(creation[0].body, creation[1].body)
  const changed = { ...original, expectedVersion: 1, member: { ...original.member, bio: '新版简介' }, accounts: [{ ...account, accountName: '新版网站' }] }
  assert.equal((await request(`/admin/members/${id}/publish`, changed)).body.data.version, 2)
  assert.equal((await request(`/admin/members/${id}/publish`, original)).status, 409)
  const current = (await request(`/admin/members/${id}`)).body.data
  assert.equal(current.accounts[0].accountName, '新版网站'); assert.equal(current.contentHash.length, 64)
  const downKey = crypto.randomUUID(), down = await Promise.all([request(`/admin/members/${id}/unpublish`, { expectedVersion: 2 }, downKey), request(`/admin/members/${id}/unpublish`, { expectedVersion: 2 }, downKey)])
  assert.ok(down.every(r => r.status === 200)); assert.deepEqual(down[0].body, down[1].body)
  assert.equal((await request(`/members/${id}`)).status, 404)
})
test('management pagination provides total/hasMore and summaries do not include body', async () => {
  const first = await request('/admin/contents?page=1&pageSize=1'), second = await request('/admin/contents?page=2&pageSize=1')
  assert.equal(first.status, 200); assert.equal(first.body.meta.pageSize, 1); assert.ok(first.body.meta.hasMore)
  assert.notEqual(first.body.data[0].id, second.body.data[0].id); assert.equal(first.body.data[0].bodyMarkdown, undefined)
  assert.equal((await request('/admin/contents?page=0')).status, 400)
})

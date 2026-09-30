import assert from 'node:assert/strict'
import test from 'node:test'
import { markdownToBodyBlocks } from '../contracts/body-blocks.ts'
import { stableStringify } from '../contracts/hash.ts'
import { validateContentWriteInput } from '../contracts/validation.ts'

test('stableStringify sorts keys and excludes server-generated fields', () => {
  assert.equal(stableStringify({ b: 2, version: 9, a: 1 }), '{"a":1,"b":2}')
})

test('markdown parser keeps supported blocks and strips unsafe links/html', () => {
  const result = markdownToBodyBlocks('# 标题\n\n你好 **四野** [危险](javascript:alert(1))\n\n<script>alert(1)</script>\n\n![图](asset://123e4567-e89b-12d3-a456-426614174000)')
  assert.deepEqual(result.blocks[0], { type: 'heading', level: 1, children: [{ text: '标题' }] })
  assert.equal(result.blocks.some((block) => block.type === 'image' && block.assetId === '123e4567-e89b-12d3-a456-426614174000'), true)
  assert.equal(JSON.stringify(result.blocks).includes('javascript:'), false)
  assert.equal(JSON.stringify(result.blocks).includes('<script>'), false)
  assert.equal(result.warnings.length > 0, true)
})

test('runtime validation rejects a poster on an essay', () => {
  const result = validateContentWriteInput({ type: 'essay', format: 'markdown', title: '测试', summary: '', bodyMarkdown: '正文', authorDisplayName: '作者', publishedAt: '2024-01-01T00:00:00+08:00', coverAssetId: null, posterAssetId: '123e4567-e89b-12d3-a456-426614174000', authorMemberId: null, imageAssetIds: [], contributors: [], tags: [], periodStart: null, periodEnd: null, stats: null })
  assert.equal(result.ok, false)
})

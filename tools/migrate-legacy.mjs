import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const toolDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(toolDir, '..')
const sourceDir = resolve(projectDir, '../docs/四野云跑-Codex开发包/legacy')
const outputPath = resolve(projectDir, 'server/data/legacy-content.json')
const reportPath = resolve(projectDir, 'docs/migration-dry-run.md')
const shouldWrite = process.argv.includes('--write')

function uuidFor(sourceKey) {
  const hash = createHash('sha1').update(`4ye.run:${sourceKey}`).digest('hex').slice(0, 32).split('')
  hash[12] = '5'
  hash[16] = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16)
  return `${hash.slice(0, 8).join('')}-${hash.slice(8, 12).join('')}-${hash.slice(12, 16).join('')}-${hash.slice(16, 20).join('')}-${hash.slice(20).join('')}`
}

function summaryOf(value, max = 132) {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean
}

function sourceDateToPublishedAt(date) {
  return `${date}T00:00:00+08:00`
}

function reportIssues(record) {
  const issues = ['统计字段未人工核验，保持为空']
  const titleDate = record.title.match(/(\d{1,2})月(\d{1,2})日/)
  if (titleDate?.[2] === '31' && titleDate?.[1] === '11') issues.push('标题包含无效日期“11月31日”，未擅自修正')
  if (titleDate && Number(titleDate[1]) !== record.month) issues.push('发布日期月份与标题周期月份不同，需人工核验')
  return issues
}

const reportsSource = JSON.parse(await readFile(resolve(sourceDir, 'data.json'), 'utf8'))
const essaysSource = JSON.parse(await readFile(resolve(sourceDir, 'essay.json'), 'utf8'))

const reports = reportsSource.map((record) => {
  const sourceKey = `legacy-report:${record.date}:${record.title}`
  return {
    id: uuidFor(sourceKey),
    sourceKey,
    sourceRecord: record,
    migrationIssues: reportIssues(record),
    type: 'report',
    title: record.title,
    summary: summaryOf(record.content),
    format: 'markdown',
    bodyMarkdown: record.content,
    coverAssetId: null,
    posterAssetId: null,
    imageAssetIds: [],
    authorMemberId: null,
    authorDisplayName: '四野云跑',
    contributors: [],
    tags: [],
    periodStart: null,
    periodEnd: null,
    stats: null,
    status: 'published',
    version: 1,
    contentHash: createHash('sha256').update(record.content).digest('hex'),
    publishedAt: sourceDateToPublishedAt(record.date),
    updatedAt: sourceDateToPublishedAt(record.date)
  }
})

const essays = essaysSource.map((record) => {
  const sourceKey = `legacy-essay:${record.id}`
  const suggestedTitle = record.description.split(/[：:。！？!?.]/)[0].trim().slice(0, 28) || `历史小作文 ${record.id}`
  const isImage = record.type === 'image'
  return {
    id: uuidFor(sourceKey),
    sourceKey,
    sourceRecord: record,
    migrationIssues: [
      `原记录缺少标题；候选标题“${suggestedTitle}”仅供确认，未作为原题`,
      ...(isImage ? ['远程图片尚未迁入 R2，保留源地址并标记待修复'] : [])
    ],
    suggestedTitle,
    type: 'essay',
    title: `未命名小作文（历史记录 ${record.id}）`,
    summary: summaryOf(record.description),
    format: isImage ? 'image' : 'markdown',
    bodyMarkdown: isImage ? `${record.description}\n\n![历史图片长文](${record.content})` : record.content,
    coverAssetId: null,
    posterAssetId: null,
    imageAssetIds: [],
    authorMemberId: null,
    authorDisplayName: record.author,
    contributors: [],
    tags: [],
    periodStart: null,
    periodEnd: null,
    stats: null,
    status: 'published',
    version: 1,
    contentHash: createHash('sha256').update(record.content).digest('hex'),
    publishedAt: sourceDateToPublishedAt(record.time),
    updatedAt: sourceDateToPublishedAt(record.time)
  }
})

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'docs/四野云跑-Codex开发包/legacy',
  mode: shouldWrite ? 'write-local-fixture' : 'dry-run',
  reports,
  essays,
  members: [],
  assets: []
}

const issueRows = [...reports, ...essays]
  .flatMap((item) => item.migrationIssues.map((issue) => `| \`${item.sourceKey}\` | ${issue.replaceAll('|', '\\|')} |`))
  .join('\n')
const report = `# 历史内容迁移 dry-run\n\n- 源文件：\`legacy/data.json\`、\`legacy/essay.json\`\n- 周报：${reports.length} 条\n- 小作文：${essays.length} 条\n- 跑友：0 条（旧数据未提供正式名片）\n- 写入生产：否\n- 本地 fixture：${shouldWrite ? '已更新' : '未更新；运行 yarn migrate:legacy:write 生成'}\n\n## 字段映射\n\n- 周报：\`date → publishedAt\`、\`title → title\`、\`content → bodyMarkdown\`；周期与统计待人工核验。\n- 小作文：\`author → authorDisplayName\`、\`time → publishedAt\`、\`description → summary\`、\`content → bodyMarkdown / 待迁图片\`。\n- ID：由固定命名空间与 sourceKey 生成稳定 UUID；重复执行不会生成不同 ID。\n- 原始记录：每条保留在 \`sourceRecord\`，没有覆盖或删除源文件。\n\n## 待核验项\n\n| sourceKey | 说明 |\n| --- | --- |\n${issueRows}\n\n## 结论\n\n本次只验证并${shouldWrite ? '写入本地开发 fixture' : '展示待写对象'}；未连接 D1、R2，未修改正式内容。图片类型小作文仍需在获得网络与云环境授权后迁入 R2。\n`

if (shouldWrite) {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
}
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, report)

console.log(JSON.stringify({
  mode: payload.mode,
  reports: reports.length,
  essays: essays.length,
  pendingIssues: [...reports, ...essays].reduce((sum, item) => sum + item.migrationIssues.length, 0),
  fixture: shouldWrite ? outputPath : null,
  report: reportPath
}, null, 2))

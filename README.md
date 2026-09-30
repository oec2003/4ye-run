# 四野云跑 Web 与共享 API

本仓库包含四野云跑公开网站、Cloudflare Worker 内容 API、D1 migration、R2 上传流程、共享 TypeScript 契约、OpenAPI 和历史数据迁移工具。

## 工程结构

```text
pages/                 Nuxt Web：周报、小作文、跑友及详情
server/api/v1/         Nitro 同域 API 路由；生产优先走 Cloudflare Service Binding
contracts/             三端共享类型、bodyBlocks、安全 Markdown 转换、hash 与运行时校验
worker/                Cloudflare API Worker、D1 migration 与 Wrangler 配置
fixtures/              开发验收 fixture，不是正式跑友数据
tools/                 历史数据转换、D1 导入 SQL、备份与密钥初始化工具
docs/                  迁移、部署和验证记录
openapi.yaml           API v1 规范
```

## 本地运行 Web

Node 20+，仓库保留 Yarn 1 lockfile：

```bash
corepack yarn install --frozen-lockfile
corepack yarn migrate:legacy:write
corepack yarn dev
```

未设置 `WORKER_API_BASE_URL` 时，`/api/v1` 只读 `server/data/legacy-content.json`：16 条周报、3 条小作文，跑友保持真实空数据。该模式拒绝所有写请求，避免误把本地 fixture 当作发布后端。

## 常用校验

```bash
corepack yarn test
corepack yarn typecheck:worker
corepack yarn build
```

Cloudflare 类型与部署：

```bash
corepack yarn types:api
corepack yarn types:web
corepack yarn configure:publish-token
corepack yarn deploy:api
corepack yarn deploy:web
```

迁移 dry-run：

```bash
corepack yarn migrate:legacy
```

本地内容 JSON 导出：

```bash
node tools/export-content.mjs ./exports/content-backup.json
```

## 接入规则

- Web 浏览器和小程序只配置一次 `PUBLIC_API_BASE_URL`，生产目标为 `https://4ye.run/api/v1`。
- Obsidian 发布插件配置 `PUBLISH_API_BASE_URL=https://api.4ye.run/api/v1`，尤其图片上传要直连 Worker。
- 发布、下架、恢复都带 `Authorization: Bearer ...`、`Idempotency-Key` 和 `expectedVersion`。
- Markdown 图片在发布前改写为 `asset://UUID`；三端渲染 `bodyBlocks`，不执行原始 HTML。
- 列表不返回正文，详情返回 `bodyBlocks`、`assets` 映射和基础字段。
- `participantCount` 是人数，`participationCount` 是人次；未知值保持 `null`。

完整云环境步骤见 [部署与运维](docs/deployment.md)，本地验证状态见 [验证记录](docs/verification.md)。

## 当前边界

生产网站与 API 已部署到 Cloudflare Workers，D1 已导入 16 条周报、3 条小作文和 19 条初始版本。`4ye.run` 与 `api.4ye.run` 已由 Worker Custom Domain 承载；Web 到 API 使用 Service Binding。`img.4ye.run` 已绑定 R2 桶 `4ye-run`，ownership 与 SSL 均为 active。历史图片长文仍保留源地址并标记待迁。发布插件应把素材二进制直传 `api.4ye.run`，不经过 Web 同域路由。

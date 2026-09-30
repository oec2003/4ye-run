# Cloudflare 部署与运维

## 当前生产拓扑

```text
浏览器 / 小程序
  ├─ https://4ye.run              Nuxt Worker + Workers Static Assets
  │    └─ /api/v1/*               Service Binding：API_SERVICE
  ├─ https://api.4ye.run          API Worker
  │    ├─ DB                      D1：4yerun
  │    └─ ASSETS                  R2：4ye-run
  └─ https://img.4ye.run          R2 Custom Domain（active，TLS 1.2+）
```

正式资源：

- Cloudflare 账户：`2170afbdc1cf71583e1b5235226c77d7`
- D1：`4yerun`，UUID `e6686ffb-aa18-41f4-92a6-a1c413528e9b`
- R2：`4ye-run`
- Web Worker：`4ye-run-web`
- API Worker：`4ye-run-api`

`wrangler.jsonc` 是 Web Worker 的正式配置；`worker/wrangler.jsonc` 是 API Worker 的正式配置。绑定有变化后必须重新运行 `types:web` 或 `types:api`，不要手写整套 Cloudflare binding 类型。

## 首次配置与校验

```bash
corepack yarn install --frozen-lockfile
corepack yarn types:api
corepack yarn types:web
corepack yarn test
corepack yarn typecheck:worker
corepack yarn build:cloudflare
```

发布令牌只保存在 Git 忽略的 `worker/.dev.vars`，权限为 `600`，不会输出到终端：

```bash
corepack yarn configure:publish-token
```

不要把该文件提交到 Git、粘贴到文档或传到公开 R2。

## D1 migration 与历史导入

```bash
./node_modules/.bin/wrangler d1 migrations list 4yerun --remote --config worker/wrangler.jsonc
./node_modules/.bin/wrangler d1 migrations apply 4yerun --remote --config worker/wrangler.jsonc
corepack yarn migrate:d1:export
./node_modules/.bin/wrangler d1 execute 4yerun --remote --config worker/wrangler.jsonc --file exports/legacy-import.sql
```

导入 SQL 以 `source_key` 去重；已存在的历史行不会被覆盖。当前生产库包含 16 条周报、3 条小作文与 19 条初始 revision。图片类型小作文仍需下载源图、验证真实 MIME/大小/hash、上传 R2，再把正文改为 `asset://UUID`。

## Worker 部署

先部署 API，再部署 Web，确保 Service Binding 的目标已存在：

```bash
corepack yarn deploy:api
corepack yarn deploy:web
```

API 部署会绑定 `api.4ye.run`；Web 部署会绑定 `4ye.run`。Custom Domain 会由 Cloudflare 管理 DNS 与证书，不要手动创建同名 A/CNAME。公开站点的浏览器请求使用 `/api/v1`，Web Worker 再通过 `API_SERVICE` 直连 API Worker；Obsidian 发布插件继续直连 `https://api.4ye.run/api/v1`。

## `img.4ye.run` 配置

生产域名已连接到 R2 桶。首次配置或灾难恢复时，先在 Cloudflare 域名概述页复制 32 位 **Zone ID**。不要发送 API Token、Global API Key 或发布令牌；只需要 Zone ID。然后运行：

```bash
./node_modules/.bin/wrangler r2 bucket domain add 4ye-run \
  --domain img.4ye.run \
  --zone-id <ZONE_ID> \
  --min-tls 1.2 \
  --config worker/wrangler.jsonc \
  --force
```

查询状态：

```bash
./node_modules/.bin/wrangler r2 bucket domain list 4ye-run --config worker/wrangler.jsonc
```

等待 ownership 与 SSL 都变为 active。不要预先创建 `img` DNS 记录；Wrangler/Cloudflare 会处理。R2 object key 由 sha256 产生并保持不可变。

## 上线核验

```bash
curl -i https://4ye.run/
curl -i 'https://4ye.run/api/v1/reports?page=1&pageSize=1'
curl -i https://api.4ye.run/api/v1/health
curl -i -H 'Origin: https://4ye.run' 'https://api.4ye.run/api/v1/reports?page=1&pageSize=1'
curl -i -X POST https://api.4ye.run/api/v1/admin/contents/00000000-0000-5000-8000-000000000000/publish
```

预期：首页和公开接口为 200；CORS 响应包含 `access-control-allow-origin: https://4ye.run`；最后一个无令牌管理请求必须为 401。若刚绑定根域时本机仍报无法解析，先用 `dig A 4ye.run @1.1.1.1` 核对权威结果，等待本机 DNS 的旧负缓存过期。

## 缓存、下架与备份

公开 API 发送 60 秒共享缓存；admin 强制 `no-store`。发布或下架后最多可能等待约 60 秒；D1 中下架内容会返回 404，但已经下载的公开图片和浏览器缓存不能被撤回。

D1 全量备份：

```bash
./node_modules/.bin/wrangler d1 export 4yerun --remote \
  --config worker/wrangler.jsonc \
  --output ./private-backups/4ye-run-YYYY-MM-DD.sql
```

备份目录必须位于私有存储，不要上传到公开 R2 桶。

## 官方文档

- [Cloudflare Nuxt on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/nuxt/)
- [Cloudflare Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare D1 导入与导出](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare R2 自定义域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)

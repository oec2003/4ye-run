# 部署与运维

以下步骤不会自动执行。先在测试环境完成，再经人工确认应用到正式环境。

## 1. Cloudflare Worker、D1 与 R2

Wrangler 需要 4.36.0 或更高版本（代码使用 Rate Limiting binding）。

```bash
cd worker
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler@latest d1 create 4ye-run-production
npx wrangler@latest r2 bucket create 4ye-run-assets-production
```

把 D1 返回的 ID 填入 `wrangler.jsonc`。`DB`、`ASSETS`、`PUBLIC_RATE_LIMITER` 是固定 binding 名，不要改成前端环境变量。应用级发布令牌只写 Worker secret：

```bash
npx wrangler@latest secret put PUBLISH_TOKEN
```

先应用本地 migration 并运行 Worker：

```bash
npx wrangler@latest d1 migrations apply 4ye-run-production --local
npx wrangler@latest dev
```

确认测试环境后，再显式应用远端 migration：

```bash
npx wrangler@latest d1 migrations apply 4ye-run-production --remote
npx wrangler@latest deploy
```

D1 `batch()` 是事务序列；本实现把条件版本更新、关联表、revision 和幂等记录放在同一 batch 内。条件更新未命中时不会写入关联，API 返回 409；历史恢复总是形成新版本。

## 2. 域名与素材

在 R2 桶设置中把 `img.4ye.run` 连接为 Custom Domain；正式环境不要依赖受限的 `r2.dev` 开发地址。确认状态为 Active 后再把 `ASSET_PUBLIC_BASE_URL` 设为该域名。R2 object key 由 sha256 产生并保持不可变。

把 Worker 绑定到 `api.4ye.run`，然后核验：

```bash
curl -i https://api.4ye.run/api/v1/health
curl -i https://api.4ye.run/api/v1/reports
curl -i -X POST https://api.4ye.run/api/v1/admin/contents/00000000-0000-5000-8000-000000000000/publish
```

前两项应为 JSON；第三项不带令牌必须为 401，不能被浏览器挑战页或 HTML fallback 替代。

## 3. Vercel Web

Vercel 项目根目录指向本仓库，框架保持 Nuxt。设置：

```text
NUXT_PUBLIC_API_BASE_URL=/api/v1
WORKER_API_BASE_URL=https://api.4ye.run/api/v1
```

Nitro 路由 `server/api/v1/[...path].ts` 是服务端代理，会保留方法、原始请求体、Content-Type、Authorization、Idempotency-Key、上游状态码和 JSON。不要再加 SPA fallback 覆盖 `/api/v1/*`。

Vercel Function 的请求/响应 payload 上限目前为 4.5 MB，而素材上限为 15 MiB。因此：

- Web 公共查询可使用同域代理；
- Obsidian 发布插件的 JSON 发布请求可直连 Worker；
- 素材 PUT 必须直连 Worker，不能经过 Vercel Function；
- 上线前分别用小文件、4.5 MB 附近和 15 MiB 文件验证实际链路。

## 4. 缓存与下架

公开 API 当前发送最长 60 秒的共享缓存；admin 强制 `no-store`。第一版没有跨 Vercel/Cloudflare 的主动 purge，所以发布或下架后最多可能等待约 60 秒。下架后 D1 查询返回 404，但已经下载的公开图片和浏览器缓存不能被撤回。

若将来要求即时失效，应增加可审计的 Cloudflare cache purge 与 Vercel cache tag 流程，不要在发布成功前声称两层缓存已经刷新。

## 5. 历史迁移

先查看 `docs/migration-dry-run.md` 和 `server/data/legacy-content.json`。正式导入必须逐条展示待写对象，不覆盖已经编辑的同 ID 正式版本；`sourceKey` 用于重复执行去重。

图片类型小作文目前处于待修复状态。获得授权后：下载源图、验证真实文件类型/大小/hash、调用 `assets/init`、PUT 二进制，再以 `asset://UUID` 更新正文。下载失败要保留源 URL 和失败记录，不能标记为完成。

## 6. 备份

D1 全量备份：

```bash
npx wrangler@latest d1 export 4ye-run-production --remote --output=./private-backups/4ye-run-$(date +%F).sql
```

备份目录必须在私有存储中；不要上传到公开 R2 桶。R2 素材按不可变 key 保存，应另行配置账户级保留与备份策略。

## 7. 官方规则核验

- [Cloudflare D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Worker Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare R2 公共桶与自定义域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare D1 导入与导出](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites)
- [Vercel Function 限制](https://vercel.com/docs/functions/limitations)

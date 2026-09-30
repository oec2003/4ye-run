# 验证记录

## 已执行

| 项目 | 结果 |
| --- | --- |
| Nuxt Cloudflare 生产构建 | 通过；Nitro `cloudflare-module`，Workers Static Assets 22 个文件 |
| API Worker 类型检查与 dry-run | 通过；D1、R2、Rate Limit 与变量绑定均被识别 |
| Web Worker dry-run | 通过；Static Assets 与 `API_SERVICE` Service Binding 均被识别 |
| 契约单元测试 | 通过：稳定 hash、Markdown 安全转换、不安全链接/HTML、essay 字段校验 |
| 远程 D1 migration | 通过；`0001_initial.sql` 已应用，9 张业务表 |
| 历史迁移 | 生产已写入 16 条周报、3 条小作文、19 条初始 revision；稳定 UUID 与 `source_key` 去重 |
| API Worker | `https://api.4ye.run/api/v1/health` 为 JSON 200 |
| API 公开读取 | 周报列表为 JSON 200，`meta.total === 16` |
| API 鉴权 | 无令牌 admin POST 为 JSON 401 |
| API CORS | `Origin: https://4ye.run` 返回精确 allow-origin 与 `Vary: Origin` |
| Web Worker 正式域 | `4ye.run` Custom Domain 已绑定，权威 A/AAAA 记录已生成 |
| Web 首页 SSR | 200；HTML 直接包含 16 期周报及 D1 内容 |
| Web 详情 SSR | `/reports/:id` 为 200；正文与元信息完整 |
| 同域 API | `https://4ye.run/api/v1/reports` 为 JSON 200 |
| R2 自定义域名 | `img.4ye.run` ownership/SSL 均为 active，最低 TLS 1.2，空桶根路径返回预期 404 |
| 正式跑友空数据 | 页面展示真实空状态，不注入效果图示例账号 |
| 本地响应式页面 | 375 / 768 / 1440 无非预期横向滚动，移动底栏未遮挡视口 |

## 浏览器与页面验收

- `/`：搜索、年份筛选、分页正常渲染；历史统计为空时未显示 0；长标题自然换行。
- `/reports/:id`：连续正文，无文字版/海报版 Tab；无海报的历史记录隐藏入口；分享按钮存在。
- `/essays`、`/essays/:id`：3 条历史内容完整渲染，详情深链 200。
- `/members`：正式数据为空时显示真实整理中状态，不展示示例账号。
- 图片预览：原图不拉伸、Esc 关闭、焦点返回；跨域下载失败时准确提示并打开原图。

## 尚待执行

- 用真实 JPEG/PNG/WebP 验证初始化、PUT、hash 不一致、15 MiB 上限与重复素材复用。
- 迁移历史图片长文的远程图片到 R2，并把正文源 URL 改写为 `asset://UUID`。
- admin 发布、版本冲突、幂等重放、下架和恢复的完整线上集成测试。
- 微信公众平台 request 合法域名、HTTPS、备案与大陆网络访问；海外可访问不能替代该验证。

`workers.dev` 子域目前未在账户中启用，因此对应预览 URL 会超时；这不影响已验证的两个正式 Custom Domain。

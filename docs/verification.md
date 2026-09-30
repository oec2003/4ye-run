# 验证记录

## 已执行

| 项目 | 结果 |
| --- | --- |
| Nuxt 生产构建 | 通过 |
| Worker TypeScript `tsc --noEmit` | 通过 |
| 契约单元测试 | 通过：稳定 hash 序列化、Markdown 安全转换、不安全链接/HTML、essay 海报字段校验 |
| D1 migration | 通过本机 SQLite 建表与 schema 检查 |
| 历史迁移 | 16 条周报、3 条小作文；22 项待核验；稳定 UUID；未写生产 |
| 正式跑友空数据 | 通过：页面展示真实空状态，不注入效果图示例账号 |
| 本地页面与 API 深链 | 通过：首页、三栏目、周报详情、小作文详情为 HTML 200；公开 API 列表为 JSON 200；未知详情为 JSON 404 |
| 响应式页面 | 通过：375 / 768 / 1440；375px 下 `scrollWidth === innerWidth`，移动底栏未遮挡当前视口 |
| 浏览器控制台 | 通过：本地首页硬刷新后无 error/warning 或运行时 exception |

## 浏览器验收结果

- `/`：搜索、年份筛选、分页正常渲染；历史统计为空时未显示 0；长标题自然换行。
- `/reports/:id`：连续正文，无文字版/海报版 Tab；无海报的历史记录已隐藏入口；分享按钮存在。
- `/essays`、`/essays/:id`：3 条历史内容完整渲染，详情深链 200；图片长文使用正文图片块而非摘要替代。
- `/members`：正式数据为空时显示真实整理中状态，不展示示例账号。
- 图片预览：原图不拉伸、Esc 关闭、焦点返回；跨域 fetch 下载失败时准确提示并打开原图。
- 375 / 768 / 1440：无非预期横向滚动，移动底栏固定在安全区域。
- 详情刷新与未知 URL：详情由 Nuxt SSR 响应；未发布/下架内容 API 为 404，页面显示 404。

## 尚需云环境执行

- Worker + D1/R2 本地联调与 admin 幂等/版本并发集成测试（本机未安装/配置 Wrangler 资源）。
- R2 真实 JPEG/PNG/WebP、hash 不一致、15 MiB 上限和重复素材复用。
- Vercel 同域代理对方法、body、Authorization、Idempotency-Key、状态码和 JSON 的线上验证。
- Worker 直连自定义域、R2 `img.4ye.run`、CORS、Rate Limiting 和 60 秒缓存可见延迟。
- Web Share、复制、Esc 焦点返回和跨域下载回退的人工交互验证（代码路径与可访问结构已检查）。
- 微信公众平台 request 合法域名、HTTPS 证书、备案和大陆网络访问；海外可访问不能替代该验证。

以上未执行项需要 Cloudflare/Vercel/域名权限，当前没有伪造通过结果，也没有修改生产 DNS 或数据。

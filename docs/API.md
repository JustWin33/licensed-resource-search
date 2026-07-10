# API 设计

## 1. 通用约定

- 前缀：`/api/v1`；跳转为稳定公开路由 `/go/{resourceId}/{provider}`，健康检查为 `/health/live`、`/health/ready`。
- 时间为 UTC ISO 8601；分页使用 `page`/`pageSize` 或稳定 cursor，单页上限 100；列表排序只允许白名单值。
- 每个请求生成/透传 `X-Request-Id`（校验长度与字符集）；错误统一为：

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found",
    "requestId": "...",
    "details": []
  }
}
```

`message` 不含堆栈、SQL、文件路径、密钥或内部对象。客户端不接收 Prisma 原始对象。

- 写接口默认拒绝未知字段；所有服务端入口再次执行 schema、权限和业务状态校验。
- 公共写接口具备 CSRF、机器人、频率限制；需幂等的接口要求 `Idempotency-Key`。

## 2. 公共读取 API

当前纵向切片已实现 `GET /api/v1/search`、`GET /api/v1/resources/{slug}` 和 `POST /api/v1/resources/{slug}/passcode`。搜索、提取码和跳转均使用 Redis 限流；提取码响应为 `no-store`，且仅在资源仍满足公开门槛时返回。

| 方法/路径                                                                     | 用途             | 鉴权/限流                     |
| ----------------------------------------------------------------------------- | ---------------- | ----------------------------- |
| `GET /api/v1/search?q=&provider=&category=&rights=&linkStatus=&sort=&cursor=` | 搜索公开资源     | 匿名，搜索限流                |
| `GET /api/v1/search/suggestions?q=`                                           | 搜索建议         | 匿名，严格限流                |
| `GET /api/v1/resources/{slug}`                                                | 详情安全 DTO     | 匿名，资源读取限流            |
| `GET /api/v1/categories`                                                      | 启用分类         | 匿名，缓存                    |
| `POST /api/v1/submissions`                                                    | 匿名提交资源     | CSRF+机器人+限流+幂等         |
| `POST /api/v1/reports`                                                        | 一般举报         | CSRF+机器人+限流              |
| `POST /api/v1/takedown-requests`                                              | 侵权通知         | CSRF+机器人+限流              |
| `GET /api/v1/cases/{ticket}`                                                  | 查询工单有限状态 | 票据校验+限流，不返回私人材料 |

搜索/详情响应只允许：资源公开字段、脱敏链接状态、有效授权类型/公开许可说明、网盘平台和更新时间。已审核且允许公开的资源可在点击查看/复制操作后受控返回提取码；提取码不进入搜索索引、初始 HTML、日志、分析事件或错误信息。

## 3. 跳转 API

`GET /go/{resourceId}/{provider}?channel={channelSlug}`：路径使用 UUIDv7/白名单 slug；服务端从数据库读取资源和链接，校验公开门槛、投诉状态、授权有效期、链接状态、平台和启用渠道，构造 URL 后返回 302，并设置 `Cache-Control: no-store`、合适的 `Referrer-Policy`。失败返回站内安全说明页或明确错误，不接受 `url`、`target`、`redirect` 等任意目标参数。

跳转记录最小化 `click_events`，不产生 `conversion_events`；渠道模板仅允许后台配置的占位符并在启动时校验。

## 4. 后台 API

当前已实现会话 login/logout/session、资源列表/创建、授权证据上传、审核和发布。写接口要求严格 SameSite 会话、双提交 CSRF、RBAC，并在资源审核/发布时校验乐观锁版本。

所有后台接口需服务端会话 + RBAC + CSRF（GET 不改变状态；敏感 GET 仍需权限）。主要路由：

| 资源     | 路由示例                                                                                                                                    | 最小权限                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 会话     | `POST /api/v1/admin/auth/login`, `POST /api/v1/admin/auth/logout`, `POST /api/v1/admin/auth/revoke-sessions`                                | 匿名/自身会话                  |
| 资源     | `GET/POST/PATCH /api/v1/admin/resources`, `POST /api/v1/admin/resources/{id}/review`, `.../publish`, `.../hide`                             | resource.write/review/publish  |
| 权利证据 | `POST /api/v1/admin/authorizations/{id}/evidence`                                                                                           | evidence.read + resource.write |
| 链接     | `/api/v1/admin/resources/{id}/links`, `POST /api/v1/admin/links/{id}/check`                                                                 | resource.write                 |
| 词库配置 | `/api/v1/admin/categories`, `/api/v1/admin/tags`, `/api/v1/admin/synonyms`, `/api/v1/admin/suggestions`                                     | settings.write                 |
| 治理     | `/api/v1/admin/submissions`, `/api/v1/admin/reports`, `/api/v1/admin/takedowns`, `/api/v1/admin/counter-notices`, `/api/v1/admin/blocklist` | governance.handle              |
| 导入     | `POST /api/v1/admin/imports/preview`, `POST /api/v1/admin/imports/{id}/confirm`, `GET /api/v1/admin/imports/{id}`                           | import.write                   |
| 分析     | `/api/v1/admin/analytics/search`, `/api/v1/admin/analytics/clicks`, `/api/v1/admin/analytics/conversions`, `/api/v1/admin/analytics/links`  | analytics.read                 |
| 运维     | `/api/v1/admin/outbox`, `/api/v1/admin/jobs`, `/api/v1/admin/audit-logs`                                                                    | audit.read/ops 权限            |
| 账号     | `/api/v1/admin/users`, `/api/v1/admin/roles`, `/api/v1/admin/permissions`                                                                   | admin.manage（仅 admin）       |

发布/隐藏/投诉处理是显式命令，不用通用 `PATCH status` 绕过状态机；响应返回变更后的安全 DTO、审计摘要和版本号。带版本的写入需要 `If-Match`/`version`，冲突返回 `VERSION_CONFLICT`。

## 5. 内部 Worker/API 约定

Worker 通过 Redis/BullMQ 和 PostgreSQL outbox 接收：`resource.index.requested`, `resource.index.removed`, `link.check.requested`, `analytics.aggregate.requested`, `retention.cleanup.requested`。消息含 `eventId`, `aggregateId`, `payloadVersion`、尝试次数；消费者幂等、指数退避、死信并记录 `job_failures`。

官方转化回调（未来启用）必须：验签、时间窗、重放 nonce/外部事件唯一键、字段 schema、来源平台 allowlist；失败不写入转化。报表导入必须预览、确认、批次幂等、逐行报告。

## 6. 鉴权、错误与版本策略

鉴权失败统一 401/403，不泄露资源存在性；资源不存在/未公开对匿名统一 404。校验 400/422，限流 429 带安全的 `Retry-After`，依赖不可用 503。API 只通过 `/api/v1` 兼容演进，破坏性变更创建 v2；字段新增默认向后兼容，弃用需记录 CHANGELOG。

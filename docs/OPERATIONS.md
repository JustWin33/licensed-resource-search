# 运维与部署设计

## 1. 运行拓扑

默认 Docker Compose：Caddy/Nginx、`web`、`worker`、PostgreSQL、Redis、Meilisearch；证据使用私有对象存储或受控文件系统，备份使用独立加密目标。公网只暴露反向代理；数据库/Redis/Meilisearch 绑定内部网络并启用鉴权。

镜像、Node.js LTS、pnpm 和依赖版本固定，不使用 `latest`。Docker 进程使用非 root，配置资源限制、健康检查和可行的只读文件系统。Node.js LTS、镜像补丁、Meilisearch/Redis/PostgreSQL 版本按实施时最新官方文档复核。

## 2. 环境与启动

提供无真实值 `.env.example`。启动时校验 schema：数据库 URL、Redis URL、Meilisearch URL/key、会话密钥、应用环境、证据存储配置、限流和保留期；生产密钥来自秘密管理器，不进镜像/日志。

阶段二命令目标：`pnpm install --frozen-lockfile`、`docker compose up -d`、`pnpm db:migrate`、一次性 `pnpm admin:create`、`pnpm dev`。这些命令在阶段二实现后才可宣称可运行。

## 3. 健康检查与可观测性

- liveness：进程事件循环存活，不访问外部依赖。
- readiness：短超时检查 PostgreSQL、Redis、Meilisearch 和必要的证据存储；失败返回依赖名称和安全错误码。
- 结构化日志：request/job ID、路由/作业、状态码、耗时、重试、队列 backlog、索引版本；脱敏，不记录提取码、证据、投诉材料、完整 IP/UA/Referer。
- 基础指标：HTTP P50/P95、错误率、限流数、outbox backlog/死信、索引延迟、链接检查成功/不确定/确定失败、投诉处理时延、清理数量、备份结果、恢复演练结果。
- 告警：数据库/队列不可用、outbox backlog 超阈值、索引删除超过 60 秒、死信、备份失败、证据存储失败、异常登录、SSRF 拒绝峰值。

## 4. 备份与恢复

每日 PostgreSQL 加密备份；证据对象存储按独立策略加密备份/版本化；备份访问最小化并记录。初始目标 RPO 24 小时、RTO 4 小时。恢复流程：隔离新流量 -> 恢复 PostgreSQL/证据 -> 运行迁移 -> 创建/校验 Redis/Meilisearch -> 全量重建索引 -> 健康检查与核心流程抽样 -> 恢复流量 -> 记录真实用时和缺陷。

未完成一次可复现演练前，RPO/RTO 只能标为目标，不能标为达成。备份恢复测试不得使用真实生产秘密或资料副本到不受控环境。

## 5. 升级、回滚与数据迁移

依赖升级先生成 PR，运行 lint/typecheck/unit/integration/e2e/扫描；数据库迁移采用向前可部署策略：先加兼容字段/索引，再切换读写，最后清理旧字段。迁移前备份，禁止 `db push` 作为生产方案。

应用回滚不得自动回滚已执行的数据库迁移；使用兼容旧版本的迁移或前向修复。搜索索引通过新索引与 Meilisearch `swap-indexes` 原子交换，旧索引保留至验证结束。变更写入 CHANGELOG 和升级手册。

## 6. 链接检查与外部平台

每个平台独立并发/速率限制；指数退避、抖动、最大重试、死信；`available` 低频复查，异常按策略复查；网络/风控不标记失效。只访问平台公开页面/正式接口，不绕过验证码、登录、风控；适配器版本和错误类别进入检查记录。平台规则按实施时官方协议复核。

## 7. 安全与合规运行检查

上线前检查安全头、TLS、可信代理、内部网络、默认账号/密码、secret scanning、依赖/容器扫描、备份加密、管理员创建、公开法律文本、联系方式、推广披露、数据保留配置和中国大陆备案/版权/数据专业评估。

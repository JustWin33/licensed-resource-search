# Licensed Resource Search

合规优先、可审计、可自托管的授权资料搜索与安全跳转平台。

当前版本为阶段二工程骨架：包含 workspace、完整 Prisma 数据模型、基础设施配置、健康检查、管理员 CLI、Worker/搜索骨架和 CI。当前不包含业务页面、真实资料、真实网盘检测或任何生产密钥。

## 当前边界

- 只处理部署者拥有、明确授权、开放许可或公有领域资料。
- 不抓取搜索引擎、盘搜站、私人群组或登录后内容。
- 不自动转存、下载、重新上传或绕过网盘验证码/风控。
- PostgreSQL 是事实源；Meilisearch 是可重建索引；搜索不可用时返回 503。

## 本地环境

要求 Node.js `24.18.0`、pnpm `11.8.0`。开发依赖使用 Docker Compose；本机可使用 Docker Desktop 或 Docker CLI + Colima。复制 `.env.example` 为 `.env` 后再启动服务。

```bash
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

管理员只能交互式创建：

```bash
pnpm admin:create
```

## 文档

需求、架构、数据库、搜索、合规、安全和运维设计位于 `docs/`。阶段任务与需求追踪见 `TASKS.md`。实现前必须阅读 `docs/ASSUMPTIONS.md` 和 `docs/THREAT_MODEL.md`。

## 许可证与贡献

代码使用 Apache License 2.0；收录资料、元数据、Logo、商标、截图和第三方网盘内容不因代码许可证自动获得授权。贡献方式见 `CONTRIBUTING.md`，安全问题请按 `SECURITY.md` 私下报告。

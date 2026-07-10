# Licensed Resource Search

合规优先、可审计、可自托管的授权资料搜索与安全跳转平台。

当前版本已进入阶段三，完成第一组纵向切片：管理员登录与 RBAC、资源/来源/授权证据审核、网盘 URL 规范化、发布 outbox、公开搜索与详情页、安全跳转和受控提取码。链接自动检查、投诉治理、批量导入及生产部署仍未实现。

## 当前边界

- 只处理部署者拥有、明确授权、开放许可或公有领域资料。
- 不抓取搜索引擎、盘搜站、私人群组或登录后内容。
- 不自动转存、下载、重新上传或绕过网盘验证码/风控。
- PostgreSQL 是事实源；Meilisearch 是可重建索引；搜索不可用时返回 503。

## 本地环境

要求 Node.js `24.17.0`、pnpm `11.8.0`。开发依赖使用 Docker Compose；本机可使用 Docker Desktop 或 Docker CLI + Colima。复制 `.env.example` 为 `.env` 后再启动服务，根命令会把该文件传给 Web、Worker 和数据库子命令。

```bash
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm admin:create
pnpm dev
```

管理员只能交互式创建；密码不会作为命令行参数或输出：

```bash
pnpm admin:create
```

## 文档

需求、架构、数据库、搜索、合规、安全和运维设计位于 `docs/`。阶段任务与需求追踪见 `TASKS.md`。实现前必须阅读 `docs/ASSUMPTIONS.md` 和 `docs/THREAT_MODEL.md`。

## 许可证与贡献

代码使用 Apache License 2.0；收录资料、元数据、Logo、商标、截图和第三方网盘内容不因代码许可证自动获得授权。贡献方式见 `CONTRIBUTING.md`，安全问题请按 `SECURITY.md` 私下报告。

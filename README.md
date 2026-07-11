# Licensed Resource Search

合规优先、可审计、可自托管的授权资料搜索与安全跳转平台。

在线访问：[GitHub Pages 公开搜索站](https://justwin33.github.io/licensed-resource-search/)

GitHub Pages 提供无需服务器即可访问的静态公开索引；管理员登录、审核、数据库搜索和服务端安全跳转需要按“生产部署”章节部署完整服务。

当前版本已完成 MVP 纵向功能：管理员与 RBAC、分类标签、资源/来源/授权证据审核、链接健康检查、Meilisearch 增量与原子重建、公开搜索与筛选、安全跳转、推广渠道、匿名投稿、举报/侵权/恢复、黑名单、CSV/Markdown 导入、隐私安全报表、数据清理和加密备份恢复。

公开站点采用与盘搜类产品相似的“搜索框优先、热门词、分类、网盘筛选、本机历史”交互，但只检索已审核且有授权依据的资源；不接入盘搜爬虫、私人群组或未授权聚合源。

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

打开 `http://localhost:3000`。资源创建后仍需独立审核、发布；发布失败时会返回未满足的准入门槛。

管理员只能交互式创建；密码不会作为命令行参数或输出：

```bash
pnpm admin:create
```

## 生产部署

仓库默认 `render.yaml` 是免费体验蓝图，创建 Web、PostgreSQL 和 Key Value，先支持管理员登录、资源录入、审核和数据库功能。免费 PostgreSQL 30 天后过期，Web 会休眠，本地证据文件不持久化，且不包含 Worker 与 Meilisearch，不应作为正式生产环境。

`render.paid.yaml` 保留完整付费蓝图，可创建 Web、Worker、PostgreSQL、Redis、Meilisearch 和持久证据目录。升级前将其内容同步为 `render.yaml`，并查看托管平台列出的实际费用；正式上线还需配置域名、备份目标、私有证据存储和合规信息。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/JustWin33/licensed-resource-search)

首次部署后，在受保护的服务 Shell 中执行 `pnpm admin:create` 创建管理员；随后执行 `pnpm search:rebuild`。生产迁移只使用 `pnpm db:migrate`，不使用 `db push`。

本地加密备份与恢复演练：

```bash
BACKUP_ENCRYPTION_PASSPHRASE='use-a-secret-manager' pnpm backup
RESTORE_CONFIRM=licensed_resource_search \
  BACKUP_ENCRYPTION_PASSPHRASE='use-a-secret-manager' \
  pnpm restore backups/example.dump.enc
pnpm db:migrate
pnpm search:rebuild
```

恢复命令会替换目标数据库，只能在隔离目标上执行。完整步骤见 `docs/OPERATIONS.md`。

## 文档

需求、架构、数据库、搜索、API、合规、安全、数据保留和运维设计位于 `docs/`。阶段任务与需求追踪见 `TASKS.md`。二次开发前请先阅读 `docs/ASSUMPTIONS.md` 和 `docs/THREAT_MODEL.md`。

## 许可证与贡献

代码使用 Apache License 2.0；收录资料、元数据、Logo、商标、截图和第三方网盘内容不因代码许可证自动获得授权。贡献方式见 `CONTRIBUTING.md`，安全问题请按 `SECURITY.md` 私下报告。

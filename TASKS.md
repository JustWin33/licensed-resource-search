# MVP 任务与需求追踪矩阵

状态：`[ ]` 未开始，`[~]` 进行中，`[x]` 已完成。阶段一只完成设计文档任务；阶段二及以后必须等待用户确认。

## 1. 阶段一任务

- [x] T1.1 固定角色、非目标、资源公开门槛和验收场景（`docs/PRD.md`）
- [x] T1.2 固定模块化单体 + Worker、数据流、故障模型、部署拓扑（`docs/ARCHITECTURE.md`）
- [x] T1.3 固定 UUIDv7、实体、字段、约束、迁移和保留策略（`docs/DATABASE.md`）
- [x] T1.4 固定索引文档、中文/拼音/排序、同步/重建和 100+ 语料评测（`docs/SEARCH_DESIGN.md`）
- [x] T1.5 固定准入、证据、投诉/恢复、推广披露和大陆部署复核要求（`docs/COMPLIANCE.md`）
- [x] T1.6 固定身份、输入、SSRF、密钥、日志、CI 和备份安全基线（`docs/SECURITY.md`）
- [x] T1.7 建立资产、信任边界、STRIDE 风险登记和专项测试清单（`docs/THREAT_MODEL.md`）
- [x] T1.8 固定公共/后台/内部 API、DTO、鉴权、错误、限流、幂等（`docs/API.md`）
- [x] T1.9 固定部署、健康检查、监控、备份恢复、升级回滚（`docs/OPERATIONS.md`）
- [x] T1.10 固定用途、访问范围、默认保留期和清理机制（`docs/DATA_RETENTION.md`）
- [x] T1.11 记录非阻塞假设与待确认项（`docs/ASSUMPTIONS.md`）
- [x] T1.12 完成文档静态检查、术语/表名/状态/追踪检查

## 2. 阶段二：初始化（待确认）

- [x] T2.1 pnpm workspace、Node LTS、锁文件、TypeScript strict、共享配置
- [x] T2.2 Next.js web、Worker、共享 packages 边界和 server-only 检查
- [x] T2.3 PostgreSQL/Prisma schema、迁移、UUIDv7、种子和一次性 admin CLI
- [x] T2.4 Redis/BullMQ、Meilisearch、Docker Compose、环境变量 schema
- [x] T2.5 health/readiness、结构化日志、请求 ID、基础指标
- [x] T2.6 lint/typecheck/unit/integration 基线与 GitHub Actions
- [x] T2.7 搜索技术验证：在正式搜索模块实现前，用 105 条业务语料对比 Meilisearch/Typesense；输出 `docs/SEARCH_BENCHMARK.md`、`test/fixtures/search-corpus.json`、`test/fixtures/search-queries.json`

## 3. 阶段三：MVP 实现（进行中）

- [x] T3.1 管理员身份、会话、RBAC、CSRF、审计
- [~] T3.2 分类、标签、资源、来源、授权记录/证据和审核状态机（资源纵向切片完成；分类/标签管理待做）
- [~] T3.3 夸克/百度/通用外链适配器、URL 安全和链接模型（存储/跳转校验完成；自动检查待做）
- [~] T3.4 outbox、幂等 Worker、Meilisearch 索引与 `swap-indexes` 重建（增量索引完成；全量重建待做）
- [~] T3.5 搜索首页、结果、详情、筛选、排序、空/错误/风控状态（基础页面与筛选完成；建议/高亮待做）
- [~] T3.6 安全跳转、渠道模板、点击事件与去刷（安全跳转和基础去重完成；渠道模板管理待做）
- [ ] T3.7 链接检查 Worker、退避、死信、检查历史、提醒
- [ ] T3.8 提交、举报、侵权通知、恢复申请、黑名单和公开票据
- [ ] T3.9 CSV/Markdown 预览确认导入、幂等和逐行报告
- [ ] T3.10 报表、官方转化回调/报表导入、保留清理、备份恢复

## 4. 阶段四：测试与加固（待确认）

- [ ] T4.1 领域状态机、权限、数据库约束、迁移集成测试
- [ ] T4.2 固定中文/拼音评测、已选引擎索引重建与相关度回归
- [ ] T4.3 搜索/跳转/提交/投诉/后台 API 测试
- [ ] T4.4 SSRF、开放重定向、CSRF、XSS、越权、限流、敏感泄露测试
- [ ] T4.5 Worker mock、重试/死信/幂等和外部平台隔离测试
- [ ] T4.6 Playwright 核心流程、移动布局和基本无障碍检查
- [ ] T4.7 恶意 CSV/Markdown、部分失败、备份恢复演练
- [ ] T4.8 10 万资源/20 万链接容量、P95、下架 60 秒目标实测

## 5. 需求追踪矩阵

| 需求 ID | 需求                                  | 设计文档                              | 任务             | 计划测试/验收                           |
| ------- | ------------------------------------- | ------------------------------------- | ---------------- | --------------------------------------- |
| R-01    | 只公开有权/授权/开放许可/公有领域资料 | PRD、COMPLIANCE、DATABASE             | T3.2             | A1 公开门槛、过期/撤回/禁止内容         |
| R-02    | 匿名搜索、筛选、中文/拼音/同义词      | PRD、SEARCH_DESIGN、API               | T3.5、T4.2       | A2 固定评测集与结果页恢复               |
| R-03    | PostgreSQL 事实源、outbox、可重建索引 | ARCHITECTURE、DATABASE、SEARCH_DESIGN | T3.4             | A3 Worker/搜索故障、重建/`swap-indexes` |
| R-04    | 夸克/百度/通用链接适配器              | PRD、COMPLIANCE、SECURITY             | T3.3、T3.7       | A4 mock 检查、URL/SSRF                  |
| R-05    | 安全跳转和推广披露                    | PRD、API、THREAT_MODEL                | T3.6、T4.4       | A5 `/go` 无开放重定向、禁用渠道         |
| R-06    | 点击与官方转化分离                    | PRD、DATABASE、API                    | T3.6、T3.10      | A6 点击不转化、回调验签/去重            |
| R-07    | 资源提交、审核、发布和复审            | PRD、DATABASE、COMPLIANCE             | T3.1、T3.2、T3.8 | A7 editor 边界、关键修改复审            |
| R-08    | 投诉、下架、恢复、黑名单              | PRD、COMPLIANCE、THREAT_MODEL         | T3.8             | A8 通知后立即隐藏、审计可追溯           |
| R-09    | 证据/联系方式/提取码最小权限          | DATABASE、SECURITY、DATA_RETENTION    | T3.2、T4.4       | A9 API/日志/客户端包无敏感值            |
| R-10    | 批量导入预览、确认、幂等、失败报告    | PRD、DATABASE、API                    | T3.9             | A10 恶意输入、重复批次、部分失败        |
| R-11    | 数据保留、清理、隐私最小化            | COMPLIANCE、DATA_RETENTION            | T3.10、T4.7      | A11 到期删除、聚合保留、脱敏            |
| R-12    | 备份、恢复、可观测性、容量目标        | ARCHITECTURE、OPERATIONS              | T2.5、T4.8       | A12 恢复演练和可复现性能报告            |
| R-13    | 开源仓库与安全治理                    | SECURITY、OPERATIONS、README 待阶段二 | T2.6、T4.4       | A13 secret/依赖/容器/CodeQL             |

## 6. 阶段验收约束

每个实现任务先补验收测试或测试方案；未运行的测试明确标注原因与命令；不得删除失败测试、永久跳过测试、写死返回值或伪造外部转化。阶段一不宣称任何运行时、性能、安全扫描或端到端结果。

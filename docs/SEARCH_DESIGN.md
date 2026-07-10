# 搜索设计与评测方案

> 文档版本：`0.2.0-architecture-approved`

## 1. 目标与选择

MVP 目标引擎固定为 Meilisearch，PostgreSQL 为事实源。Meilisearch 只存可公开的搜索文档；隐藏、撤回、删除事件必须从索引移除，但搜索 API 仍做数据库公开状态复核。全量重建使用官方 `swap-indexes` 原子索引交换，不使用传统索引别名。

Typesense 保留为实施前对比对象。不能以“中文支持”这一笼统判断替代实测；必须用至少 100 条贴近业务的中文语料，按本文件的固定查询集在相同机器、数据、版本和 warm-up 条件下比较。

## 2. 索引文档

每个公开资源映射一个显式文档，不写入证据、联系方式、提取码、内部备注或未审核字段：

```ts
type PublicSearchDocument = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categories: string[];
  tags: string[];
  authorOrSources: string[];
  titlePinyinFull: string;
  titlePinyinInitials: string;
  tagsPinyinFull: string[];
  tagsPinyinInitials: string[];
  providerSlugs: string[];
  rightsStatus: string;
  publishedAt: string;
  updatedAt: string;
  linkStatuses: string[];
  completenessScore: number;
  linkHealthScore: number;
  freshnessEpoch: number;
  dedupedClickScore: number;
  ownerWeightCapped: number;
};
```

字段配置：可搜索 `title`, `summary`, `categories`, `tags`, `authorOrSources`, 拼音辅助字段；可筛选 `providerSlugs`, `rightsStatus`, `linkStatuses`, `publishedAt`; 可排序 `publishedAt`, `updatedAt`, `dedupedClickScore`, `completenessScore`, `linkHealthScore`。展示文本由 PostgreSQL 安全投影提供，防止索引成为公开字段真相。

## 3. 中文、繁简、拼音与容错

- 写入时生成标题、标签的全拼和首字母；多音字使用词典/人工词条优先，无法确定时生成有限候选并在评测中检查误召回。
- 简繁处理使用受控标准化映射，不把所有变体无条件合并；原始标题仍保留用于展示。
- 管理员同义词以版本化配置发布；同义词变更产生 outbox 事件并记录审计。
- 1～2 字查询默认精确/前缀为主；数字、版本号、提取码、专有名词不启用宽松拼写容错。
- 错别字容错只在长度足够且不是数字/代码/提取码时启用；所有容错结果进入固定评测。
- 搜索建议来自管理员词、已审核资源词和脱敏聚合词，不直接把含个人信息的原始搜索词公开。

## 4. 排序原则

相关性优先，推荐实现顺序：精确标题/短语 > 标题词 > 标签/分类/来源 > 简介 > 链接可用性与完整度 > 权利可信等级 > 有上限的自有资源权重 > 新鲜度衰减 > 去刷点击热度。

人工审核只是公开前置条件，不作为公开资源之间的排序分数。自有资源权重必须有硬上限；推广渠道、收益和未验证转化不得进入排序。点击分数按时间衰减的去重点击量计算，排除管理员、机器人、重复快速点击和已知异常流量。

排序参数必须版本化，并在后台说明主要因素。`relevance`、`newest`、`popular` 是对外稳定的排序标识，不允许客户端传入任意字段名。

## 5. 同步与重建

事务写入资源后插入 `outbox_events`，事件至少包含聚合 ID、事件类型、载荷版本和变更时间。Worker 以事件 ID/聚合版本幂等更新：

1. 读取当前资源并重新计算“是否可公开”；
2. 可公开则构造文档并 upsert，不可公开则删除；
3. 记录处理时间；失败增加重试次数并进入指数退避，超过阈值写死信/告警。

全量重建：创建新索引 -> 按游标从 PostgreSQL 读取公开安全投影 -> 批量写入 -> 等待任务完成并执行计数/抽样校验 -> 调用 `swap-indexes` 原子交换新旧索引 -> 保留旧索引可回退 -> 记录构建版本。禁止直接在生产索引上清空重建造成半成品可见。

## 6. Meilisearch 与 Typesense 对比计划

| 维度          | Meilisearch 预期优点         | Typesense 预期优点     | 必须实测                      |
| ------------- | ---------------------------- | ---------------------- | ----------------------------- |
| 中文切词/CJK  | 部署简单、前缀体验好         | 可控 schema 与查询参数 | 中文词、混搜、短词召回/误召回 |
| 拼音          | 需写入辅助字段，行为可控     | 同样需应用侧字段       | 全拼、首字母、多音字          |
| 容错          | 配置简单                     | 可细粒度控制查询       | 错别字、数字/版本禁容错       |
| 筛选排序      | filterable/sortable 字段清晰 | 字段与查询控制强       | 组合筛选、排序稳定性          |
| 同义词        | 内置管理                     | 内置/配置能力          | 版本发布、回滚、重建          |
| 索引速度/内存 | 中小规模部署友好预期         | 轻量且可扩展预期       | 10 万资源/20 万链接投影       |
| 运维          | 单服务、低运维复杂度         | 单服务、配置项不同     | 备份、升级、监控、恢复        |

测试语料至少包含 100 条：AI 学习、Claude Code/Codex、开源项目、提示词、编程教程、公共版权资料；记录原始语料、预期相关文档 ID、语言/简繁/拼音/错误标注。固定查询包括：`Claude Code`、`克劳德代码`、`claude code`、常见 1 字/2 字中文、全拼、首字母、一个错别字、英文+中文、数字版本号、提取码样式、同义词、组合过滤、相关度/最新/热门。

报告必须记录引擎版本、Node/OS、CPU/RAM、文档数、索引耗时、内存峰值、warm-up 方法、每查询 P50/P95、召回率、误召回样例、筛选/排序结果和运维结论。若 Meilisearch 关键指标不满足，先更新 ADR 并请求确认，不能在代码中悄悄切换 Typesense。搜索引擎能力和版本必须按实施时最新官方文档复核。

## 7. 搜索事件与隐私

记录标准化查询、筛选、结果数、时间、低精度会话 ID；默认保留 90 天，之后只保留不可还原的日级聚合。后台有敏感词过滤和访问权限；不得构建跨站画像。无结果词用于管理员补充词库/资料需求，不直接作为公开推荐证据。

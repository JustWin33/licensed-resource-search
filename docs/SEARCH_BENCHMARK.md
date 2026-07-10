# 搜索技术验证报告

## 1. 结论

阶段二 T2.7 已执行。当前继续使用 Meilisearch 作为 MVP 搜索引擎，并保留 Typesense 作为已验证的备选。两者都能在本测试语料上完成中文、英文、混合检索和应用侧拼音字段检索；Typesense 在本地小数据集上的延迟和空载内存更低，但 Meilisearch 的查询非空比例略高、现有架构与已定文档更一致。该结果不是 10 万条生产规模容量结论，也不代表任何外部网盘或生产网络条件下的性能。

## 2. 测试条件

- 时间：2026-07-10（Asia/Shanghai）
- 机器：本机 macOS Apple Silicon，Docker/Colima VM，4 vCPU、8 GiB VM、60 GiB Docker disk
- Node.js：`v24.17.0`
- Meilisearch：`getmeili/meilisearch:v1.37.0`
- Typesense：`typesense/typesense:29.0`
- 语料：105 条贴近业务的中文/英文资料记录，位于 `test/fixtures/search-corpus.json`
- 查询：30 条，位于 `test/fixtures/search-queries.json`
- 查询类型：中文短词、简繁、英文、中文+英文、真实全拼、首字母、同义词样例、数字版本号、过滤相关字段
- 预热：每个引擎先创建 collection/index、写入并等待任务完成，再逐条执行查询
- 内存：benchmark 后运行 `docker stats --no-stream` 单点采样，不是峰值

## 3. 结果摘要

| 指标                | Meilisearch | Typesense |
| ------------------- | ----------: | --------: |
| 索引写入/设置耗时   |      131 ms |     20 ms |
| 查询 P50            |    46.10 ms |   1.08 ms |
| 查询 P95            |    50.62 ms |   2.10 ms |
| 查询平均耗时        |    31.52 ms |   1.17 ms |
| 30 条查询中非空结果 |          26 |        25 |
| Docker 内存单点采样 |     149 MiB | 44.38 MiB |

上述延迟包含本机 Docker 网络与客户端请求，查询数量很小，不能替代阶段四的容量基准。Meilisearch 的 P50/P95 较高，需在阶段三/四继续校准索引字段、过滤策略和连接复用。

## 4. 关键检索观察

| 查询             | Meilisearch         | Typesense     | 观察                                                                        |
| ---------------- | ------------------- | ------------- | --------------------------------------------------------------------------- |
| `克劳德代码`     | 0                   | 0             | 当前语料没有为该繁简/别名建立同义词；需由后台词库补充，不能假设引擎自动完成 |
| `rengongzhineng` | `c-005`             | `c-005`       | 应用侧真实全拼字段有效                                                      |
| `rgzn`           | `c-005`             | `c-005`       | 应用侧首字母字段有效                                                        |
| `tishici`        | `c-006,c-007`       | `c-007,c-006` | 两者召回一致，顺序不同                                                      |
| `kaiyuanxiangmu` | `c-008`             | `c-008`       | 全拼有效                                                                    |
| `kyxm`           | `c-008`             | `c-008`       | 首字母有效                                                                  |
| `Next.js 16`     | `c-104,c-012`       | `c-104`       | Meilisearch 在本语料上召回更多，需用固定相关度期望继续评测                  |
| `PostgreSQL 18`  | `c-046,c-013,c-093` | `c-046`       | 版本/相关字段排序存在差异，不能把默认排序直接当业务最终排序                 |
| `开放许可`       | 10 条               | 24 条         | Typesense 召回更宽，需要检查误召回和排序质量                                |

拼音不是依赖引擎自动生成：benchmark 使用 `pinyin-pro` 生成 `titlePinyinFull`、`titlePinyinInitials` 和标签拼音辅助字段。多音字、简繁、同义词仍需业务词典和固定评测集。

## 5. 运维与选择

- Meilisearch：部署与配置路径简单，当前文档、搜索 DTO、`swap-indexes` 重建方案已经围绕它固定；适合作为 MVP 目标，但必须优化查询延迟和扩大容量测试。
- Typesense：本次小数据集延迟和内存更优，但宽召回、排序差异需要更多人工标注语料；切换会改变索引配置、客户端和运维脚本。
- 未根据单次小规模测试悄悄切换引擎。若阶段四在 10 万资源/20 万链接投影上证明 Meilisearch 不满足目标，必须先新增 ADR、补充标注集并得到确认。
- T2.7 只测试本地公开测试服务，不访问真实网盘域名，不执行链接状态探测。

## 6. 可复现命令

```bash
docker compose --profile search-benchmark up -d --wait typesense
MEILI_HOST=http://127.0.0.1:7700 \
MEILI_MASTER_KEY=dev-only-meilisearch-master-key-change-me \
TYPESENSE_HOST=127.0.0.1 \
TYPESENSE_PORT=8108 \
TYPESENSE_API_KEY=dev-only-typesense-key-change-me \
pnpm search:benchmark
docker stats --no-stream licensed-resource-search-meilisearch-1 licensed-resource-search-typesense-1
```

import { randomUUID } from 'node:crypto';
import { createSearchClient, publicIndexSettings, type PublicSearchDocument } from './index.js';

const host = process.env.MEILI_HOST ?? 'http://127.0.0.1:7700';
const apiKey = process.env.MEILI_MASTER_KEY ?? '';
if (!apiKey) throw new Error('MEILI_MASTER_KEY is required for search smoke');

const client = createSearchClient(host, apiKey);
const indexUid = `stage2-smoke-${randomUUID().replaceAll('-', '')}`;
const index = client.index(indexUid);
const doc: PublicSearchDocument = {
  id: randomUUID(),
  slug: 'stage2-smoke',
  title: 'Claude Code 工程骨架',
  summary: 'Meilisearch stage two smoke fixture',
  categories: ['AI'],
  categorySlugs: ['ai'],
  tags: ['Claude Code'],
  titlePinyinFull: 'claudecodegongchenggujia',
  titlePinyinInitials: 'cldgcgj',
  providerSlugs: ['generic'],
  rightsStatus: 'open_licensed',
  publishedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  linkStatuses: ['available'],
  completenessScore: 100,
};

await index.updateSettings(publicIndexSettings);
const addTask = await index.addDocuments([doc], { primaryKey: 'id' });
await client.tasks.waitForTask(addTask.taskUid);
const result = await index.search('Claude Code');
if (result.hits.length !== 1) throw new Error(`Expected one search hit, got ${result.hits.length}`);
await client.deleteIndex(indexUid);
console.log('search smoke passed');

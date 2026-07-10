import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MeiliSearch } from 'meilisearch';
import { pinyin } from 'pinyin-pro';
import Typesense from 'typesense';

type Fixture = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  category: string;
};

type QueryFixture = { id: string; query: string; kind: string };

const corpus = JSON.parse(
  await readFile(resolve(process.cwd(), '../../test/fixtures/search-corpus.json'), 'utf8'),
) as Fixture[];
const queries = JSON.parse(
  await readFile(resolve(process.cwd(), '../../test/fixtures/search-queries.json'), 'utf8'),
) as QueryFixture[];

if (corpus.length < 100)
  throw new Error(`Search corpus must contain at least 100 records, got ${corpus.length}`);

const documents = corpus.map((item) => ({
  ...item,
  tagsText: item.tags.join(' '),
  titlePinyinFull: pinyin(item.title, { toneType: 'none', type: 'array' }).join(''),
  titlePinyinInitials: pinyin(item.title, { toneType: 'none', type: 'array' })
    .map((part) => part[0] ?? '')
    .join(''),
  tagsPinyinFull: pinyin(item.tags.join(' '), { toneType: 'none' }),
  providerSlugs: ['generic'],
  rightsStatus: 'open_licensed',
  publishedAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  linkStatuses: ['available'],
  completenessScore: 100,
}));

const meiliHost = process.env.MEILI_HOST ?? 'http://127.0.0.1:7700';
const meiliKey = process.env.MEILI_MASTER_KEY ?? '';
const typesenseHost = process.env.TYPESENSE_HOST ?? '127.0.0.1';
const typesensePort = Number(process.env.TYPESENSE_PORT ?? 8108);
const typesenseKey = process.env.TYPESENSE_API_KEY ?? 'dev-only-typesense-key-change-me';
const runId = Date.now().toString(36);
const meiliIndexUid = `benchmark-${runId}`;
const typesenseCollectionName = `benchmark_${runId}`;

function now() {
  return performance.now();
}

async function benchmarkMeilisearch() {
  const client = new MeiliSearch({ host: meiliHost, apiKey: meiliKey });
  const index = client.index(meiliIndexUid);
  const start = now();
  await index.updateSettings({
    searchableAttributes: [
      'title',
      'summary',
      'tags',
      'category',
      'titlePinyinFull',
      'titlePinyinInitials',
      'tagsPinyinFull',
    ],
    filterableAttributes: ['category', 'rightsStatus', 'providerSlugs', 'linkStatuses'],
    sortableAttributes: ['publishedAt', 'updatedAt', 'completenessScore'],
  });
  const task = await index.addDocuments(documents, { primaryKey: 'id' });
  await client.tasks.waitForTask(task.taskUid);
  const indexMs = Math.round(now() - start);
  const queryResults = [];
  for (const query of queries) {
    const queryStart = now();
    const result = await index.search(query.query, { limit: 10 });
    queryResults.push({
      id: query.id,
      kind: query.kind,
      hits: result.hits.length,
      durationMs: Math.round((now() - queryStart) * 100) / 100,
      topIds: result.hits.slice(0, 3).map((hit) => String(hit.id)),
    });
  }
  await client.deleteIndex(meiliIndexUid);
  return { engine: 'meilisearch', version: '1.37.0', indexMs, queryResults };
}

async function benchmarkTypesense() {
  const client = new Typesense.Client({
    nodes: [{ host: typesenseHost, port: typesensePort, protocol: 'http' }],
    apiKey: typesenseKey,
    connectionTimeoutSeconds: 5,
  });
  const start = now();
  await client.collections().create({
    name: typesenseCollectionName,
    fields: [
      { name: 'title', type: 'string' },
      { name: 'summary', type: 'string' },
      { name: 'tags', type: 'string[]' },
      { name: 'category', type: 'string', facet: true },
      { name: 'titlePinyinFull', type: 'string' },
      { name: 'titlePinyinInitials', type: 'string' },
      { name: 'tagsPinyinFull', type: 'string' },
      { name: 'rightsStatus', type: 'string', facet: true },
      { name: 'providerSlugs', type: 'string[]', facet: true },
      { name: 'linkStatuses', type: 'string[]', facet: true },
      { name: 'publishedAt', type: 'string', sort: true },
      { name: 'updatedAt', type: 'string', sort: true },
      { name: 'completenessScore', type: 'int32', sort: true },
    ],
  });
  await client
    .collections(typesenseCollectionName)
    .documents()
    .import(documents, { action: 'upsert' });
  const indexMs = Math.round(now() - start);
  const queryResults = [];
  for (const query of queries) {
    const queryStart = now();
    const result = await client.collections(typesenseCollectionName).documents().search({
      q: query.query,
      query_by: 'title,summary,tags,category,titlePinyinFull,titlePinyinInitials,tagsPinyinFull',
      per_page: 10,
    });
    queryResults.push({
      id: query.id,
      kind: query.kind,
      hits: result.found,
      durationMs: Math.round((now() - queryStart) * 100) / 100,
      topIds: (result.hits ?? [])
        .slice(0, 3)
        .map((hit) => String((hit.document as { id: string }).id)),
    });
  }
  await client.collections(typesenseCollectionName).delete();
  return { engine: 'typesense', version: '29.0', indexMs, queryResults };
}

const [meilisearch, typesense] = await Promise.all([benchmarkMeilisearch(), benchmarkTypesense()]);
console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      corpusSize: corpus.length,
      queryCount: queries.length,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryCollection: 'not collected by client benchmark; use docker stats --no-stream',
      },
      meilisearch,
      typesense,
    },
    null,
    2,
  ),
);

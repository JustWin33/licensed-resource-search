import { MeiliSearch } from 'meilisearch';
import { pinyin } from 'pinyin-pro';

export const PUBLIC_RESOURCE_INDEX = 'public-resources-v1';

export type PublicSearchDocument = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categories: string[];
  categorySlugs: string[];
  tags: string[];
  titlePinyinFull: string;
  titlePinyinInitials: string;
  providerSlugs: string[];
  rightsStatus: string;
  publishedAt: string;
  updatedAt: string;
  linkStatuses: string[];
  completenessScore: number;
};

export type SearchDocumentInput = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categories: string[];
  categorySlugs: string[];
  tags: string[];
  providerSlugs: string[];
  rightsStatus: string;
  publishedAt: Date;
  updatedAt: Date;
  linkStatuses: string[];
  completenessScore: number;
};

export function buildPublicSearchDocument(input: SearchDocumentInput): PublicSearchDocument {
  const titlePinyin = pinyin(input.title, { toneType: 'none', type: 'array' });
  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    categories: input.categories,
    categorySlugs: input.categorySlugs,
    tags: input.tags,
    titlePinyinFull: titlePinyin.join(''),
    titlePinyinInitials: titlePinyin.map((part) => part[0] ?? '').join(''),
    providerSlugs: input.providerSlugs,
    rightsStatus: input.rightsStatus,
    publishedAt: input.publishedAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    linkStatuses: input.linkStatuses,
    completenessScore: input.completenessScore,
  };
}

export function createSearchClient(host: string, apiKey: string) {
  return new MeiliSearch({ host, apiKey });
}

export const publicIndexSettings = {
  searchableAttributes: [
    'title',
    'summary',
    'categories',
    'tags',
    'titlePinyinFull',
    'titlePinyinInitials',
  ],
  filterableAttributes: [
    'providerSlugs',
    'categorySlugs',
    'rightsStatus',
    'linkStatuses',
    'publishedAt',
  ],
  sortableAttributes: ['publishedAt', 'updatedAt', 'completenessScore'],
};

export function buildSynonymMap(termGroups: unknown[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const group of termGroups) {
    if (!Array.isArray(group)) continue;
    const terms = [
      ...new Set(
        group
          .filter((term): term is string => typeof term === 'string')
          .map((term) => term.normalize('NFKC').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (terms.length < 2) continue;
    for (const term of terms) map[term] = terms.filter((candidate) => candidate !== term);
  }
  return map;
}

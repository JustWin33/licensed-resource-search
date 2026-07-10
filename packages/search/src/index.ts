import { MeiliSearch } from 'meilisearch';

export type PublicSearchDocument = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categories: string[];
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
  filterableAttributes: ['providerSlugs', 'rightsStatus', 'linkStatuses', 'publishedAt'],
  sortableAttributes: ['publishedAt', 'updatedAt', 'completenessScore'],
};

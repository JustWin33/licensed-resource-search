import { describe, expect, it } from 'vitest';
import { buildSynonymMap, publicIndexSettings } from './index.js';

describe('public search index settings', () => {
  it('keeps sensitive fields out of the searchable schema', () => {
    expect(publicIndexSettings.searchableAttributes).not.toContain('passcode');
    expect(publicIndexSettings.filterableAttributes).toContain('providerSlugs');
    expect(publicIndexSettings.filterableAttributes).toContain('categorySlugs');
  });

  it('builds symmetric normalized synonyms and ignores invalid groups', () => {
    expect(buildSynonymMap([[' Claude Code ', 'CC'], ['one'], 'invalid'])).toEqual({
      'claude code': ['cc'],
      cc: ['claude code'],
    });
  });
});

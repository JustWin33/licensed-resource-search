import { describe, expect, it } from 'vitest';
import { publicIndexSettings } from './index.js';

describe('public search index settings', () => {
  it('keeps sensitive fields out of the searchable schema', () => {
    expect(publicIndexSettings.searchableAttributes).not.toContain('passcode');
    expect(publicIndexSettings.filterableAttributes).toContain('providerSlugs');
  });
});

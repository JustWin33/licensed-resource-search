import { describe, expect, it } from 'vitest';
import { canTransitionPublishedResource } from './states.js';

describe('published resource change policy', () => {
  it('requires review for rights, source or link changes', () => {
    expect(
      canTransitionPublishedResource({
        rightsChanged: true,
        sourceChanged: false,
        linkChanged: false,
      }),
    ).toBe('requires_review');
  });
  it('allows ordinary edits only when protected fields are unchanged', () => {
    expect(
      canTransitionPublishedResource({
        rightsChanged: false,
        sourceChanged: false,
        linkChanged: false,
      }),
    ).toBe('ordinary_edit');
  });
});

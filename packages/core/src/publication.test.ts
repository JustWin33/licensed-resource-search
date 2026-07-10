import { describe, expect, it } from 'vitest';
import { publicationGate } from './publication';

const publishable = {
  reviewStatus: 'approved',
  publicationStatus: 'published',
  complaintStatus: 'none',
  rightsStatus: 'authorized',
  deletedAt: null,
  activeSourceCount: 1,
  activeAuthorizationCount: 1,
  enabledLinkCount: 1,
};

describe('publication gate', () => {
  it('accepts a fully approved resource', () => {
    expect(publicationGate(publishable)).toEqual({ ok: true });
  });

  it('rejects complaint-hidden and evidence-free resources', () => {
    const result = publicationGate({
      ...publishable,
      complaintStatus: 'temporarily_hidden',
      activeAuthorizationCount: 0,
    });
    expect(result).toEqual({
      ok: false,
      reasons: ['complaint_blocks_publication', 'active_authorization_required'],
    });
  });
});

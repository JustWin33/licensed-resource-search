export type PublicationGateInput = {
  reviewStatus: string;
  publicationStatus: string;
  complaintStatus: string;
  rightsStatus: string;
  deletedAt: Date | null;
  activeSourceCount: number;
  activeAuthorizationCount: number;
  enabledLinkCount: number;
};

const allowedRights = new Set(['owned', 'authorized', 'open_licensed', 'public_domain']);

export function publicationGate(
  input: PublicationGateInput,
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (input.reviewStatus !== 'approved') reasons.push('review_not_approved');
  if (input.publicationStatus !== 'published') reasons.push('not_published');
  if (!allowedRights.has(input.rightsStatus)) reasons.push('rights_not_publishable');
  if (!['none', 'restored'].includes(input.complaintStatus))
    reasons.push('complaint_blocks_publication');
  if (input.deletedAt) reasons.push('resource_deleted');
  if (input.activeSourceCount < 1) reasons.push('source_required');
  if (input.activeAuthorizationCount < 1) reasons.push('active_authorization_required');
  if (input.enabledLinkCount < 1) reasons.push('enabled_link_required');
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export function reviewGate(
  input: Omit<PublicationGateInput, 'reviewStatus' | 'publicationStatus'>,
) {
  return publicationGate({ ...input, reviewStatus: 'approved', publicationStatus: 'published' });
}

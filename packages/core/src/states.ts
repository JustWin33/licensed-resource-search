export const resourcePublicationGate = {
  approvedReview: 'approved',
  published: 'published',
  allowedRights: ['owned', 'authorized', 'open_licensed', 'public_domain'],
} as const;

export function canTransitionPublishedResource(input: {
  rightsChanged: boolean;
  sourceChanged: boolean;
  linkChanged: boolean;
}): 'requires_review' | 'ordinary_edit' {
  return input.rightsChanged || input.sourceChanged || input.linkChanged
    ? 'requires_review'
    : 'ordinary_edit';
}

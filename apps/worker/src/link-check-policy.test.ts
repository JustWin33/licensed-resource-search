import { describe, expect, it } from 'vitest';
import { resolveObservedLinkStatus } from './link-check-policy.js';

describe('link check confirmation policy', () => {
  it('requires two consecutive deterministic failures', () => {
    expect(
      resolveObservedLinkStatus({
        currentStatus: 'available',
        observedStatus: 'expired',
        statusConfirmations: 0,
      }),
    ).toEqual({ currentStatus: 'available', statusConfirmations: 1 });
    expect(
      resolveObservedLinkStatus({
        currentStatus: 'available',
        observedStatus: 'expired',
        previousObservedStatus: 'expired',
        statusConfirmations: 1,
      }),
    ).toEqual({ currentStatus: 'expired', statusConfirmations: 2 });
  });

  it('does not replace a known-good status with an uncertain result', () => {
    expect(
      resolveObservedLinkStatus({
        currentStatus: 'available',
        observedStatus: 'unknown',
        statusConfirmations: 2,
      }).currentStatus,
    ).toBe('available');
  });
});

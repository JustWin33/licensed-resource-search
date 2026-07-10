import type { LinkStatus } from '@platform/cloud-drives';

const uncertainStatuses = new Set<LinkStatus>(['unknown', 'risk_controlled']);
const deterministicFailureStatuses = new Set<LinkStatus>(['expired', 'password_error']);

export function resolveObservedLinkStatus(input: {
  currentStatus: LinkStatus;
  observedStatus: LinkStatus;
  previousObservedStatus?: LinkStatus;
  statusConfirmations: number;
}) {
  const confirmations =
    input.previousObservedStatus === input.observedStatus ? input.statusConfirmations + 1 : 1;
  if (deterministicFailureStatuses.has(input.observedStatus) && confirmations < 2) {
    return { currentStatus: input.currentStatus, statusConfirmations: confirmations };
  }
  if (
    uncertainStatuses.has(input.observedStatus) &&
    ['available', 'need_password'].includes(input.currentStatus)
  ) {
    return { currentStatus: input.currentStatus, statusConfirmations: confirmations };
  }
  return { currentStatus: input.observedStatus, statusConfirmations: confirmations };
}

export function nextCheckAt(status: LinkStatus, now = new Date()): Date {
  const delayHours: Record<LinkStatus, number> = {
    pending: 12,
    available: 24 * 7,
    expired: 24 * 14,
    need_password: 24 * 7,
    password_error: 24,
    risk_controlled: 24,
    unsupported: 24 * 30,
    unknown: 24,
    disabled: 24 * 30,
  };
  return new Date(now.getTime() + delayHours[status] * 60 * 60_000);
}

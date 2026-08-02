import { ApprovalStatus, PublishingStatus } from '@prisma/client'

// Allowed approval status transitions
const APPROVAL_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'REVISION_REQUESTED', 'REJECTED'],
  REVISION_REQUESTED: ['DRAFT', 'IN_REVIEW'],
  APPROVED: [],
  REJECTED: ['DRAFT'],
}

// Allowed publishing status transitions
const PUBLISHING_TRANSITIONS: Record<PublishingStatus, PublishingStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'SCHEDULED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT'],
  APPROVED: ['SCHEDULED'],
  SCHEDULED: ['QUEUED', 'CANCELLED', 'NEEDS_MANUAL_FINALIZATION'],
  QUEUED: ['POSTING', 'CANCELLED'],
  POSTING: ['PROCESSING', 'POSTED', 'FAILED'],
  PROCESSING: ['POSTED', 'FAILED'],
  POSTED: [],
  FAILED: ['QUEUED', 'CANCELLED'],
  CANCELLED: [],
  NEEDS_MANUAL_FINALIZATION: ['POSTED', 'CANCELLED', 'QUEUED'],
}

/**
 * Validates that an approval status transition is allowed.
 */
export function validateApprovalTransition(
  from: ApprovalStatus,
  to: ApprovalStatus
): { valid: boolean; error?: string } {
  const allowed = APPROVAL_TRANSITIONS[from]
  if (!allowed) {
    return { valid: false, error: `Unknown status: ${from}` }
  }
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Cannot transition approval status from '${from}' to '${to}'. Allowed: ${allowed.join(', ') || 'none'}`,
    }
  }
  return { valid: true }
}

/**
 * Validates that a publishing status transition is allowed.
 */
export function validatePublishingTransition(
  from: PublishingStatus,
  to: PublishingStatus
): { valid: boolean; error?: string } {
  const allowed = PUBLISHING_TRANSITIONS[from]
  if (!allowed) {
    return { valid: false, error: `Unknown status: ${from}` }
  }
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Cannot transition publishing status from '${from}' to '${to}'. Allowed: ${allowed.join(', ') || 'none'}`,
    }
  }
  return { valid: true }
}

export { APPROVAL_TRANSITIONS, PUBLISHING_TRANSITIONS }

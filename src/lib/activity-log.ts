import prisma from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

type LogAction =
  | 'user.login'
  | 'workspace.created'
  | 'brand.created'
  | 'social_account.connected'
  | 'social_account.disconnected'
  | 'social_account.reconnected'
  | 'content.created'
  | 'content.updated'
  | 'content.deleted'
  | 'content.submitted_review'
  | 'content.approved'
  | 'content.rejected'
  | 'content.revision_requested'
  | 'content.scheduled'
  | 'content.unscheduled'
  | 'content.cancelled'
  | 'media.uploaded'
  | 'media.deleted'
  | 'publishing.started'
  | 'publishing.succeeded'
  | 'publishing.failed'
  | 'publishing.draft_uploaded'
  | 'publishing.marked_posted'
  | 'publishing.retry_queued'
  | 'token.refreshed'
  | 'member.invited'
  | 'member.role_changed'
  | 'member.removed'

interface LogActivityParams {
  workspaceId: string
  actorId?: string
  entityType: string
  entityId?: string
  action: LogAction
  metadata?: Record<string, unknown> | null
}

/**
 * Writes a structured activity log entry to the database.
 * Fire-and-forget safe: errors are caught and logged to console.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        workspaceId: params.workspaceId,
        actorId: params.actorId ?? null,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        action: params.action,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    // Never throw from logging — just warn
    console.warn('[ActivityLog] Failed to write log:', err)
  }
}

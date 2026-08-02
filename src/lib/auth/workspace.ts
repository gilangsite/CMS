import { auth, currentUser } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { Role } from '@prisma/client'

export interface WorkspaceContext {
  userId: string
  workspaceId: string
  role: Role
  clerkId: string
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workspace'
  )
}

/**
 * Syncs the signed-in Clerk user to our database, creating the User row on
 * first sign-in and provisioning a default workspace if they don't belong
 * to one yet. Safe to call on every request — it's a cheap upsert.
 */
export async function syncUser(): Promise<void> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return

  const cu = await currentUser()
  if (!cu) return

  const email = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress
    ?? cu.emailAddresses[0]?.emailAddress
    ?? `${clerkId}@unknown.local`
  const name = [cu.firstName, cu.lastName].filter(Boolean).join(' ') || cu.username || email
  const avatarUrl = cu.imageUrl || null

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: { email, name, avatarUrl },
    create: { clerkId, email, name, avatarUrl },
  })

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
  })
  if (existingMembership) return

  // First sign-in with no workspace yet — provision one so the user can
  // start working immediately without a separate onboarding step.
  const slugBase = slugify(name)
  let slug = slugBase
  let attempt = 1
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${attempt++}`
  }

  await prisma.workspace.create({
    data: {
      name: `${name}'s Workspace`,
      slug,
      createdBy: user.id,
      members: {
        create: { userId: user.id, role: 'OWNER' },
      },
    },
  })
}

/**
 * Returns the current signed-in user's DB record, or null if not
 * authenticated or not yet synced.
 */
export async function getCurrentUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  return prisma.user.findUnique({ where: { clerkId } })
}

/**
 * Gets the current user's workspace membership from the request context.
 * Throws if the user is not authenticated or not a member of the workspace.
 */
export async function getWorkspaceContext(workspaceId: string): Promise<WorkspaceContext> {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error('User has not been synced yet')

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId },
  })
  if (!membership) throw new Error('Not a member of this workspace')

  return {
    userId: user.id,
    workspaceId,
    role: membership.role,
    clerkId,
  }
}

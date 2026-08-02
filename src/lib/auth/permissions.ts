import { Role } from '@prisma/client'

export type Permission =
  | '*'
  | 'manage_workspace'
  | 'manage_accounts'
  | 'manage_members'
  | 'manage_brands'
  | 'approve'
  | 'publish'
  | 'edit'
  | 'create'
  | 'edit_own'
  | 'submit_review'
  | 'view'
  | 'comment'
  | 'delete'
  | 'delete_own'

const PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ['*'],
  ADMIN: ['manage_workspace', 'manage_accounts', 'manage_members', 'manage_brands', 'approve', 'publish', 'edit', 'create', 'edit_own', 'submit_review', 'view', 'comment', 'delete'],
  MANAGER: ['approve', 'publish', 'edit', 'create', 'edit_own', 'submit_review', 'view', 'comment', 'delete_own'],
  CREATOR: ['create', 'edit_own', 'submit_review', 'view', 'comment', 'delete_own'],
  CLIENT: ['view', 'comment', 'approve'],
  VIEWER: ['view'],
}

/**
 * Check if a given role has a specific permission.
 * OWNER with '*' has all permissions.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = PERMISSIONS[role]
  if (!perms) return false
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

/**
 * Throws an error if the role does not have the required permission.
 */
export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: role '${role}' cannot perform '${permission}'`)
  }
}

/**
 * Returns all permissions for a role (expanded from '*' if OWNER).
 */
export function getPermissions(role: Role): Permission[] {
  if (role === 'OWNER') {
    return [
      'manage_workspace', 'manage_accounts', 'manage_members', 'manage_brands',
      'approve', 'publish', 'edit', 'create', 'edit_own', 'submit_review',
      'view', 'comment', 'delete', 'delete_own',
    ]
  }
  return PERMISSIONS[role] ?? []
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CREATOR: 'Creator',
  VIEWER: 'Viewer',
  CLIENT: 'Client',
}

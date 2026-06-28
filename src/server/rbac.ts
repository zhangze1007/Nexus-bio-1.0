/**
 * Role-Based Access Control (RBAC) System
 *
 * Provides fine-grained permission control for Nexus-Bio projects.
 *
 * Roles:
 *   - owner: Full control (delete, manage members, settings)
 *   - editor: Read/write access to project data
 *   - viewer: Read-only access
 *
 * Permissions are checked at the API route level before data access.
 *
 * @security
 *   ENFORCEMENT: API routes must call requirePermission() before data access
 *   AUDIT: All permission changes are logged to sync_audit table
 */

// ── Types ──────────────────────────────────────────────────────────────

export type Role = 'owner' | 'editor' | 'viewer';

export interface Permission {
  /** Can read project state */
  read: boolean;
  /** Can write/update project state */
  write: boolean;
  /** Can delete the project */
  delete: boolean;
  /** Can manage members (invite/remove) */
  manageMembers: boolean;
  /** Can change project settings */
  manageSettings: boolean;
  /** Can export project data */
  export: boolean;
}

export interface ProjectMember {
  actorId: string;
  role: Role;
  joinedAt: number;
  invitedBy?: string;
}

export interface RBACContext {
  /** Current user ID */
  userId: string;
  /** Project ID */
  projectId: string;
  /** User's role in the project */
  role: Role;
}

// ── Role Permissions ───────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, Permission> = {
  owner: {
    read: true,
    write: true,
    delete: true,
    manageMembers: true,
    manageSettings: true,
    export: true,
  },
  editor: {
    read: true,
    write: true,
    delete: false,
    manageMembers: false,
    manageSettings: false,
    export: true,
  },
  viewer: {
    read: true,
    write: false,
    delete: false,
    manageMembers: false,
    manageSettings: false,
    export: false,
  },
};

// ── Permission Checking ────────────────────────────────────────────────

/**
 * Get permissions for a given role.
 */
export function getPermissions(role: Role): Permission {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: Role, permission: keyof Permission): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Require a specific permission. Throws if not granted.
 *
 * @param context - RBAC context with user, project, and role
 * @param permission - Required permission
 * @throws Error if permission denied
 */
export function requirePermission(context: RBACContext, permission: keyof Permission): void {
  if (!hasPermission(context.role, permission)) {
    throw new Error(
      `Permission denied: ${context.userId} does not have '${permission}' permission on project ${context.projectId} (role: ${context.role})`
    );
  }
}

/**
 * Check if a user can perform an action on a project.
 *
 * @param userId - User ID
 * @param projectId - Project ID
 * @param members - Current project members
 * @param permission - Required permission
 * @returns true if allowed
 */
export function canPerformAction(
  userId: string,
  projectId: string,
  members: ProjectMember[],
  permission: keyof Permission,
): boolean {
  const member = members.find(m => m.actorId === userId);
  if (!member) return false;
  return hasPermission(member.role, permission);
}

// ── Member Management ──────────────────────────────────────────────────

/**
 * Add a member to a project.
 *
 * @param members - Current members list
 * @param actorId - User to add
 * @param role - Role to assign
 * @param invitedBy - Who is inviting
 * @returns Updated members list
 */
export function addMember(
  members: ProjectMember[],
  actorId: string,
  role: Role,
  invitedBy: string,
): ProjectMember[] {
  // Check if already a member
  const existing = members.find(m => m.actorId === actorId);
  if (existing) {
    // Update role if different
    if (existing.role !== role) {
      return members.map(m =>
        m.actorId === actorId ? { ...m, role } : m
      );
    }
    return members;
  }

  return [
    ...members,
    {
      actorId,
      role,
      joinedAt: Date.now(),
      invitedBy,
    },
  ];
}

/**
 * Remove a member from a project.
 *
 * @param members - Current members list
 * @param actorId - User to remove
 * @returns Updated members list
 */
export function removeMember(
  members: ProjectMember[],
  actorId: string,
): ProjectMember[] {
  return members.filter(m => m.actorId !== actorId);
}

/**
 * Change a member's role.
 *
 * @param members - Current members list
 * @param actorId - User to update
 * @param newRole - New role
 * @returns Updated members list
 */
export function changeRole(
  members: ProjectMember[],
  actorId: string,
  newRole: Role,
): ProjectMember[] {
  return members.map(m =>
    m.actorId === actorId ? { ...m, role: newRole } : m
  );
}

// ── Role Hierarchy ─────────────────────────────────────────────────────

/**
 * Check if one role is higher than another.
 *
 * owner > editor > viewer
 */
export function isHigherRole(role1: Role, role2: Role): boolean {
  const hierarchy: Record<Role, number> = { owner: 3, editor: 2, viewer: 1 };
  return hierarchy[role1] > hierarchy[role2];
}

/**
 * Get the highest role from a list of members.
 */
export function getHighestRole(members: ProjectMember[]): Role | null {
  if (members.length === 0) return null;

  let highest: Role = 'viewer';
  for (const member of members) {
    if (isHigherRole(member.role, highest)) {
      highest = member.role;
    }
  }
  return highest;
}

// ── Display ────────────────────────────────────────────────────────────

/**
 * Get human-readable role description.
 */
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    owner: 'Full control — can delete project, manage members, and change settings',
    editor: 'Read/write access — can modify project data and export',
    viewer: 'Read-only access — can view project data but not modify',
  };
  return descriptions[role];
}

/**
 * Get role color for UI display.
 */
export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    owner: '#E8A3A1',   // CORAL
    editor: '#AFC3D6',  // SKY
    viewer: '#BFDCCD',  // MINT
  };
  return colors[role];
}

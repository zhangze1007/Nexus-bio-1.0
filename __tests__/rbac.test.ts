/**
 * RBAC authorization tests — with a focus on the horizontal / cross-project
 * privilege-escalation fix.
 *
 * Before the fix, `canPerformAction(userId, projectId, members, permission)`
 * ignored `projectId`: it granted access to anyone present in `members` with a
 * capable role, regardless of which project the membership was for. Membership
 * is now scoped to `projectId`, so a role on one project never authorizes an
 * action on another.
 *
 * Roles (highest→lowest): owner > editor > viewer.
 */
import {
  addMember,
  canPerformAction,
  changeRole,
  getHighestRole,
  getPermissions,
  hasPermission,
  isHigherRole,
  type ProjectMember,
  type Role,
  removeMember,
} from "../src/server/rbac";

const mkMember = (projectId: string, actorId: string, role: Role): ProjectMember => ({
  projectId,
  actorId,
  role,
  joinedAt: 0,
});

describe("rbac — cross-project privilege escalation is prevented", () => {
  // Alice owns projA only.
  const members: ProjectMember[] = [mkMember("projA", "alice", "owner"), mkMember("projB", "bob", "editor")];

  it("allows an action on the project the user is actually a member of", () => {
    expect(canPerformAction("alice", "projA", members, "read")).toBe(true);
    expect(canPerformAction("alice", "projA", members, "delete")).toBe(true);
    expect(canPerformAction("bob", "projB", members, "write")).toBe(true);
  });

  it("DENIES an action on a different project even for a privileged user (the fix)", () => {
    // Alice is an owner — but of projA, not projB. She must NOT act on projB.
    expect(canPerformAction("alice", "projB", members, "read")).toBe(false);
    expect(canPerformAction("alice", "projB", members, "write")).toBe(false);
    expect(canPerformAction("alice", "projB", members, "delete")).toBe(false);
    // Symmetrically, editor bob has no rights on projA.
    expect(canPerformAction("bob", "projA", members, "read")).toBe(false);
  });

  it("DENIES a user who has no membership record at all", () => {
    expect(canPerformAction("mallory", "projA", members, "read")).toBe(false);
    expect(canPerformAction("mallory", "projB", members, "read")).toBe(false);
  });

  it("scopes role per project when a user belongs to multiple projects", () => {
    // Carol: owner of projA, but only viewer of projB.
    const multi: ProjectMember[] = [mkMember("projA", "carol", "owner"), mkMember("projB", "carol", "viewer")];
    // Full rights on projA:
    expect(canPerformAction("carol", "projA", multi, "delete")).toBe(true);
    expect(canPerformAction("carol", "projA", multi, "manageMembers")).toBe(true);
    // Only read on projB — write/delete denied there:
    expect(canPerformAction("carol", "projB", multi, "read")).toBe(true);
    expect(canPerformAction("carol", "projB", multi, "write")).toBe(false);
    expect(canPerformAction("carol", "projB", multi, "delete")).toBe(false);
  });
});

describe("rbac — role tiers grant the expected permissions (same-project)", () => {
  const owner: ProjectMember[] = [mkMember("p", "u", "owner")];
  const editor: ProjectMember[] = [mkMember("p", "u", "editor")];
  const viewer: ProjectMember[] = [mkMember("p", "u", "viewer")];

  it("owner: full control", () => {
    for (const perm of ["read", "write", "delete", "manageMembers", "manageSettings", "export"] as const) {
      expect(canPerformAction("u", "p", owner, perm)).toBe(true);
    }
  });

  it("editor: read/write/export but not delete/manage", () => {
    for (const perm of ["read", "write", "export"] as const) {
      expect(canPerformAction("u", "p", editor, perm)).toBe(true);
    }
    for (const perm of ["delete", "manageMembers", "manageSettings"] as const) {
      expect(canPerformAction("u", "p", editor, perm)).toBe(false);
    }
  });

  it("viewer: read-only", () => {
    expect(canPerformAction("u", "p", viewer, "read")).toBe(true);
    for (const perm of ["write", "delete", "manageMembers", "manageSettings", "export"] as const) {
      expect(canPerformAction("u", "p", viewer, perm)).toBe(false);
    }
  });
});

describe("rbac — member management is project-scoped", () => {
  it("addMember scopes membership to the project (same actor, two projects)", () => {
    let members: ProjectMember[] = [];
    members = addMember(members, "projA", "alice", "owner", "system");
    members = addMember(members, "projB", "alice", "viewer", "system");
    expect(members).toHaveLength(2);
    expect(canPerformAction("alice", "projA", members, "delete")).toBe(true);
    expect(canPerformAction("alice", "projB", members, "delete")).toBe(false);
    expect(canPerformAction("alice", "projB", members, "read")).toBe(true);
  });

  it("addMember updates the role only within the same project", () => {
    let members: ProjectMember[] = [mkMember("projA", "alice", "viewer"), mkMember("projB", "alice", "viewer")];
    members = addMember(members, "projA", "alice", "owner", "system");
    expect(members).toHaveLength(2); // no new record — updated in place
    expect(canPerformAction("alice", "projA", members, "delete")).toBe(true);
    expect(canPerformAction("alice", "projB", members, "delete")).toBe(false); // projB untouched
  });

  it("removeMember removes only the target project's membership", () => {
    const members: ProjectMember[] = [mkMember("projA", "alice", "owner"), mkMember("projB", "alice", "editor")];
    const after = removeMember(members, "projA", "alice");
    expect(after).toHaveLength(1);
    expect(canPerformAction("alice", "projA", after, "read")).toBe(false); // removed here
    expect(canPerformAction("alice", "projB", after, "write")).toBe(true); // still a member there
  });

  it("changeRole updates only the target project's role", () => {
    const members: ProjectMember[] = [mkMember("projA", "alice", "owner"), mkMember("projB", "alice", "owner")];
    const after = changeRole(members, "projA", "alice", "viewer");
    expect(canPerformAction("alice", "projA", after, "delete")).toBe(false); // demoted here
    expect(canPerformAction("alice", "projB", after, "delete")).toBe(true); // projB unchanged
  });
});

describe("rbac — role hierarchy utilities (unchanged behavior)", () => {
  it("permission map and hierarchy are consistent", () => {
    expect(getPermissions("owner").delete).toBe(true);
    expect(getPermissions("viewer").write).toBe(false);
    expect(hasPermission("editor", "export")).toBe(true);
    expect(isHigherRole("owner", "editor")).toBe(true);
    expect(isHigherRole("viewer", "owner")).toBe(false);
    expect(getHighestRole([mkMember("p", "a", "viewer"), mkMember("p", "b", "owner")])).toBe("owner");
    expect(getHighestRole([])).toBeNull();
  });
});

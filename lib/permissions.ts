import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Client-safe: shared by the auth server/client plugins and UI checks.
// UI checks are UX only — every page, action and route handler must re-check on the server.

const crud = ["view", "create", "update", "delete"] as const;

export const statement = {
  // `user` and `session` are required by the BetterAuth admin plugin
  ...defaultStatements,
  role: ["view", "create", "update", "delete"],
  asset: [...crud, "import", "export", "printLabel"],
  deployment: [...crud, "swap"],
  ticket: [...crud, "assign", "close", "viewAll"],
  pm: [...crud, "execute"],
  claim: [...crud],
  audit: [...crud, "scan", "approve"],
  label: [...crud],
  masterData: [...crud],
  report: ["view"],
  log: ["view", "clear", "export"],
  backup: ["view", "run", "restore"],
  system: ["view", "editInfo"],
  office3d: ["view", "configureLayout", "viewAllZones"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
    role: ["view", "create", "update", "delete"],
    asset: [...crud, "import", "export", "printLabel"],
    deployment: [...crud, "swap"],
    ticket: [...crud, "assign", "close", "viewAll"],
    pm: [...crud, "execute"],
    claim: [...crud],
    audit: [...crud, "scan", "approve"],
    label: [...crud],
    masterData: [...crud],
    report: ["view"],
    log: ["view", "clear", "export"],
    backup: ["view", "run", "restore"],
    system: ["view", "editInfo"],
    office3d: ["view", "configureLayout", "viewAllZones"],
  }),
  manager: ac.newRole({
    user: ["list", "get"],
    masterData: ["view"],
    asset: ["view", "export"],
    deployment: ["view"],
    ticket: ["view", "assign", "viewAll"],
    pm: ["view"],
    claim: ["view"],
    audit: ["view", "approve"],
    label: ["view"],
    report: ["view"],
    log: ["view", "export"],
    office3d: ["view", "viewAllZones"],
  }),
  technician: ac.newRole({
    asset: ["view", "printLabel"],
    deployment: ["view", "swap"],
    ticket: ["view", "update", "close"],
    pm: ["view", "execute"],
    claim: ["view", "create", "update"],
    label: ["view"],
    office3d: ["view"],
  }),
  helpdesk: ac.newRole({
    asset: ["view"],
    ticket: ["view", "create", "update", "assign", "viewAll"],
    office3d: ["view"],
  }),
  auditor: ac.newRole({
    asset: ["view"],
    audit: ["view", "scan"],
    office3d: ["view"],
  }),
  user: ac.newRole({
    asset: ["view"],
    ticket: ["view", "create"],
    office3d: ["view"],
  }),
};

export type RoleName = keyof typeof roles;
export type Resource = keyof typeof statement;
export type Action<R extends Resource> = (typeof statement)[R][number];
/** Granted actions per resource, as stored in Role.permissions */
export type PermissionMap = Partial<Record<Resource, string[]>>;

export const ADMIN_ROLE = "admin";
export const builtInRoles = Object.keys(roles) as RoleName[];

export function isRoleName(role: string): role is RoleName {
  return role in roles;
}

/** Built-in permission sets from the definitions above (used until a Role row overrides them). */
export const defaultPermissions = Object.fromEntries(
  builtInRoles.map((r) => [r, Object.fromEntries(Object.entries(roles[r].statements).map(([res, acts]) => [res, [...(acts as readonly string[])]]))]),
) as Record<RoleName, PermissionMap>;

const allPermissions = Object.fromEntries(Object.entries(statement).map(([res, acts]) => [res, [...acts]])) as PermissionMap;

/**
 * Permission sets edited in the UI (Role table). Loaded on the server for every request (lib/roles.ts)
 * and passed to the client shell, so checks on both sides use the same data.
 */
let overrides: Record<string, PermissionMap> = {};
export function setRolePermissions(map: Record<string, PermissionMap>) {
  overrides = map;
}

export function permissionsOf(role: string): PermissionMap {
  if (role === ADMIN_ROLE) return allPermissions; // never editable, so nobody can lock the system out
  return overrides[role] ?? (isRoleName(role) ? defaultPermissions[role] : {});
}

/**
 * Resources and actions that can be granted in the UI. `session` and `impersonate*` stay admin-only:
 * BetterAuth checks them itself against the static role definitions.
 */
export const assignable = Object.fromEntries(
  (Object.keys(statement) as Resource[])
    .filter((r) => r !== "session")
    .map((r) => [r, (statement[r] as readonly string[]).filter((a) => !a.startsWith("impersonate"))]),
) as Record<Resource, string[]>;

/** Keep only known resource/action pairs; any granted action implies "view"/"list" so menus and pages open. */
export function sanitizePermissions(raw: unknown): PermissionMap {
  const out: PermissionMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [res, acts] of Object.entries(raw as Record<string, unknown>)) {
    const allowed = assignable[res as Resource];
    if (!allowed || !Array.isArray(acts)) continue;
    const picked = allowed.filter((a) => acts.includes(a));
    if (!picked.length) continue;
    for (const base of ["view", "list"]) if (allowed.includes(base) && !picked.includes(base)) picked.unshift(base);
    out[res as Resource] = picked;
  }
  return out;
}

/** True if any of the user's roles (comma-separated, BetterAuth format) grants the action. */
export function can<R extends Resource>(role: string | null | undefined, resource: R, action: Action<R>): boolean {
  if (!role) return false;
  return role
    .split(",")
    .map((r) => r.trim())
    .some((r) => permissionsOf(r)[resource]?.includes(action) ?? false);
}

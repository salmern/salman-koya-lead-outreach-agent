import "server-only";

import { createAdminClient, createClient } from "@/server/supabase";

/**
 * Role model — two active roles, one legacy alias:
 *
 *   researcher  Can do everything: create runs, research, review leads,
 *               review/edit/approve outreach drafts. This is the standard role
 *               for every person who uses the tool.
 *
 *   admin       Same as researcher, plus user-role management (/admin).
 *
 *   viewer      Kept in the DB enum for backward compatibility with any
 *               pre-existing accounts. Treated as equivalent to researcher in
 *               all authorization checks — there is no read-only mode in the
 *               PRD, so a separate viewer restriction has no product basis.
 *
 * Design decision: the PRD describes a single user who "defines the target
 * persona, searches for companies, checks whether each company fits, reviews
 * company websites, and writes cold outreach". There is no mention of a
 * stakeholder who should see the results but not act on them. Rather than
 * invent a restriction the PRD does not require, we give every authenticated
 * user the same research-and-review capability and reserve admin only for
 * user management.
 */
export type Role = "admin" | "researcher" | "viewer";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
}

/**
 * Numeric hierarchy used by canRole.
 * viewer == researcher == 1 (same capability; viewer is a legacy alias).
 * admin == 2 (researcher + user management).
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 1,     // same as researcher — no read-only restriction in the PRD
  researcher: 1,
  admin: 2,
};

export function canRole(role: Role, required: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[required];
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Returns the authenticated user + profile, or null when anonymous. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    role: (profile?.role ?? "researcher") as Role,
    fullName: profile?.full_name ?? null,
  };
}

/**
 * Returns a profile via service-role lookup — used by privileged worker code.
 * Never call with raw client input.
 */
export async function getProfileFromDb(userId: string): Promise<{
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
} | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  return data as unknown as {
    id: string;
    email: string;
    full_name: string | null;
    role: Role;
  } | null;
}

/** Throws 401 when anonymous. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Authentication required", 401);
  return user;
}

/** Throws 401/403 when anonymous or lacking the required role. */
export async function requireRole(required: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Authentication required", 401);
  if (!canRole(user.role, required)) {
    throw new AuthError("You do not have permission for this action", 403);
  }
  return user;
}

/**
 * Admin-scoped client: verifies the caller is an admin, returns service-role
 * client for privileged operations.
 */
export async function requireAdminClient() {
  await requireRole("admin");
  return createAdminClient();
}

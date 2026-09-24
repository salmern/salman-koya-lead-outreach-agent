import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { config } from "@/server/config";

/**
 * Supabase client bound to the request's auth cookies.
 * Use in Server Components, route handlers and server actions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component (no mutable cookies) — safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role admin client. Privileged database access. NEVER use in client
 * code or for user-facing queries without an explicit authorization check.
 */
export function createAdminClient() {
  return createSupabaseClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
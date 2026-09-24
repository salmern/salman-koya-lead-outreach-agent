/**
 * Create the three demo accounts (admin / researcher / viewer) used by the
 * login page's quick-fill buttons.
 *
 *   npm run seed:demo
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 * in the environment. Idempotent: existing demo users get their password and
 * role reset to the demo values, so re-running after schema changes is safe.
 *
 * Demo credentials are public by design (see lib/demo-users.ts).
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

import { DEMO_USERS } from "../lib/demo-users";

function loadLocalEnv() {
  // tsx does not auto-load .env.local. Existing shell env takes precedence, so
  // loading the file is safe in CI too.
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
      return;
    } catch (err) {
      console.warn(`Could not load ${file}:`, err instanceof Error ? err.message : err);
    }
  }
}

async function main() {
  loadLocalEnv();

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingPage, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("listUsers failed:", listError.message);
    process.exit(1);
  }
  const byEmail = new Map((existingPage?.users ?? []).map((u) => [u.email?.toLowerCase(), u]));

  for (const demo of DEMO_USERS) {
    const existing = byEmail.get(demo.email.toLowerCase());

    if (!existing) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: demo.email,
        password: demo.password,
        email_confirm: true,
        user_metadata: { full_name: demo.fullName },
      });
      if (error) {
        console.error(`Could not create ${demo.email}:`, error.message);
        process.exit(1);
      }
      const id = created.user?.id;
      if (!id) {
        console.error(`createUser returned no user for ${demo.email}.`);
        process.exit(1);
      }
      await supabase
        .from("profiles")
        .update({
          role: demo.role,
          email: demo.email,
          full_name: demo.fullName,
        })
        .eq("id", id);
      console.log(`Created ${demo.email} as ${demo.role} (${id}).`);
      continue;
    }

    const id = existing.id;
    const { error: pwError } = await supabase.auth.admin.updateUserById(id, {
      password: demo.password,
      email_confirm: true,
      user_metadata: { full_name: demo.fullName },
    });
    if (pwError) {
      console.error(`Could not reset password for ${demo.email}:`, pwError.message);
      process.exit(1);
    }
    const { error: roleError } = await supabase
      .from("profiles")
      .update({
        role: demo.role,
        email: demo.email,
        full_name: demo.fullName,
      })
      .eq("id", id);
    if (roleError) {
      console.error(`Could not set role for ${demo.email}:`, roleError.message);
      process.exit(1);
    }
    console.log(`Updated ${demo.email} as ${demo.role} (${id}).`);
  }

  console.log("Demo users ready. Log in from the login page with the quick-fill buttons.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
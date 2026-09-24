/**
 * Create (or demote/promote) an admin user in the profiles table.
 *
 * Usage:
 *   EMAIL=admin@example.com npm run create-admin
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment and the
 * user to already exist in Supabase Auth (sign up first, then promote).
 * New users are NEVER auto-promoted — admin is always an explicit action.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

function loadLocalEnv() {
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
  const email = process.env.EMAIL;

  if (!url || !key || !email) {
    console.error(
      "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and EMAIL before running.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("listUsers failed:", listError.message);
    process.exit(1);
  }

  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No auth user found for "${email}". Have them sign up first.`);
    process.exit(1);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id);

  if (error) {
    console.error("Could not promote user:", error.message);
    process.exit(1);
  }

  console.log(`Promoted ${email} (${user.id}) to admin.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
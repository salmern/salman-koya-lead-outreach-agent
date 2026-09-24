/**
 * Verify the required Supabase schema exists. Useful after applying migrations.
 *
 *   npm run migrate:check
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "profiles",
  "research_runs",
  "leads",
  "outreach_drafts",
  "tool_calls",
  "run_events",
];

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ok = true;
  for (const table of TABLES) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      ok = false;
      console.error(`✗ ${table}: ${error.message}`);
    } else {
      console.log(`✓ ${table}`);
    }
  }

  if (!ok) {
    console.error("\nSchema is missing tables. Apply supabase/migrations first.");
    process.exit(1);
  }
  console.log("\nSchema looks good.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
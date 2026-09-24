import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isExternalIntegrationConfigured } from "@/server/config";
import { createAdminClient } from "@/server/supabase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Setup · Koya Lead Agent" };

interface Check {
  label: string;
  env: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, detail: "Supabase URL / service role key missing." };
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("research_runs").select("id").limit(1);
    if (error) return { ok: false, detail: `Database responded: ${error.message}` };
    return { ok: true, detail: "Migrations applied and service role can read research_runs." };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Unknown database error." };
  }
}

export default async function SetupPage() {
  const integrations = isExternalIntegrationConfigured();
  const db = await checkDatabase();

  const checks: Check[] = [
    {
      label: "Supabase",
      env: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
      ok: integrations.supabase && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      detail: "Auth, database and Row Level Security.",
      required: true,
    },
    {
      label: "Anthropic",
      env: "ANTHROPIC_API_KEY",
      ok: integrations.anthropic,
      detail: "Runs the Claude Agent SDK research agent. Without it the research phase cannot run.",
      required: true,
    },
    {
      label: "Apify",
      env: "APIFY_API_TOKEN, APIFY_ACTOR_ID",
      ok: integrations.apify,
      detail: "Company discovery. You must supply a team token and actor ID from the console.",
      required: true,
    },
    {
      label: "Firecrawl",
      env: "FIRECRAWL_API_KEY",
      ok: integrations.firecrawl,
      detail: "Preferred website research. Optional — a controlled fetch fallback is used.",
      required: false,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Server className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Setup status</h1>
          <p className="text-sm text-muted-foreground">
            Configuration check. This page never displays secret values.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Database</CardTitle>
          <CardDescription>{db.detail}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className={db.ok ? "text-success" : "text-destructive"}>
            {db.ok ? "Connected" : "Not ready"}
          </span>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {checks.map((check) => (
          <Card key={check.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{check.label}</CardTitle>
                <CardDescription>{check.detail}</CardDescription>
              </div>
              {check.ok ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <CircleAlert className={check.required ? "h-5 w-5 text-destructive" : "h-5 w-5 text-warning"} />
              )}
            </CardHeader>
            <CardContent>
              <code className="rounded bg-muted px-2 py-1 text-xs">{check.env}</code>
              <span className="ml-3 text-sm text-muted-foreground">
                {check.ok ? "Configured" : check.required ? "Required" : "Optional — not set"}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/server/auth";
import { isExternalIntegrationConfigured } from "@/server/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const integrations = isExternalIntegrationConfigured();
  if (!integrations.supabase) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Koya Lead Agent</h1>
        <p className="text-muted-foreground">
          Supabase is not configured yet. Add your environment variables, then apply the database
          migrations to get started.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/setup">View setup status</Link>
          </Button>
        </div>
      </main>
    );
  }

  const user = await getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/server/auth";
import { isExternalIntegrationConfigured } from "@/server/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const integrations = isExternalIntegrationConfigured();
  const missing = [
    !integrations.supabase && "Supabase",
    !integrations.anthropic && "Anthropic",
    !integrations.apify && "Apify",
  ].filter(Boolean) as string[];

  return (
    <AppShell user={{ email: user.email, role: user.role, fullName: user.fullName }}>
      {missing.length > 0 && (
        <div className="mb-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-medium">Not fully configured.</span>{" "}
          Missing: {missing.join(", ")}. Runs cannot complete until these are set.{" "}
          <a href="/setup" className="underline underline-offset-4">
            View setup
          </a>
          .
        </div>
      )}
      {children}
    </AppShell>
  );
}
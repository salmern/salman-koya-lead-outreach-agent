import { CheckCircle2, CircleAlert } from "lucide-react";

import { ProfileForm } from "@/components/settings/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth";
import { isExternalIntegrationConfigured } from "@/server/config";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const integrations = isExternalIntegrationConfigured();

  const rows = [
    { label: "Supabase", ok: integrations.supabase },
    { label: "Anthropic (Claude Agent SDK)", ok: integrations.anthropic },
    { label: "Apify (company discovery)", ok: integrations.apify },
    { label: "Firecrawl (website research, optional)", ok: integrations.firecrawl },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and integration status.</p>
      </div>

      <ProfileForm email={user.email} role={user.role} fullName={user.fullName} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>
            Secrets are read from server environment variables and never shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{row.label}</span>
              <span className="flex items-center gap-2">
                {row.ok ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Configured
                  </>
                ) : (
                  <>
                    <CircleAlert className="h-4 w-4 text-warning" />
                    Not set
                  </>
                )}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
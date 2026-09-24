import { redirect } from "next/navigation";

import { UserRoleTable } from "@/components/admin/user-role-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/server/auth";
import { listProfiles } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const users = await listProfiles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; roles</h1>
        <p className="text-sm text-muted-foreground">
          Manage who can view, run research, and administer the workspace.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team members</CardTitle>
          <CardDescription>
            Researchers can create and run research, review leads, and edit outreach.
            Admins additionally manage user roles. Viewer is a legacy alias for researcher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserRoleTable users={users} currentUserId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
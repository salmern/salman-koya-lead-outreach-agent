import Link from "next/link";
import { ArrowRight, Building2, FileSearch, PlusCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunStatusBadge } from "@/components/runs/status-badge";
import { getSessionUser } from "@/server/auth";
import { listRunsForViewer } from "@/server/user-db";
import { formatRelative, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  let runs: Awaited<ReturnType<typeof listRunsForViewer>> = [];
  let error: string | null = null;
  try {
    runs = await listRunsForViewer();
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load runs.";
  }

  const totals = runs.reduce(
    (acc, run) => {
      acc.qualified += run.qualified_count;
      acc.needsReview += run.needs_review_count;
      acc.companies += run.candidate_count;
      return acc;
    },
    { qualified: 0, needsReview: 0, companies: 0 },
  );

  const canRun = !!user;

  const stats = [
    { label: "Research runs", value: runs.length, icon: FileSearch },
    { label: "Qualified leads", value: totals.qualified, icon: ShieldCheck },
    { label: "Companies discovered", value: totals.companies, icon: Building2 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Evidence-backed company research and review-ready outreach drafts.
          </p>
        </div>
        {canRun && (
          <Button asChild>
            <Link href="/runs/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              New research run
            </Link>
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FileSearch className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No research runs yet. Create one to refine an ICP and discover companies.
              </p>
              {canRun && (
                <Button asChild variant="outline">
                  <Link href="/runs/new">Create your first run</Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objective</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Qualified</TableHead>
                  <TableHead className="text-right">Leads to review</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="max-w-[380px] font-medium">
                      {truncate(run.original_objective, 90)}
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-right">{run.qualified_count}</TableCell>
                    <TableCell className="text-right">{run.needs_review_count}</TableCell>
                    <TableCell className="text-muted-foreground">{formatRelative(run.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/runs/${run.id}`}>
                          Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { CheckCircle2, CircleX, Minus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QualityReport, RunRecord } from "@/lib/types";

function CountTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "success" | "destructive";
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-muted/40 p-3",
      highlight === "success" && "border-success/30 bg-success/10",
      highlight === "destructive" && "border-destructive/30 bg-destructive/10",
    )}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 text-2xl font-bold tabular-nums",
        highlight === "success" && "text-success",
        highlight === "destructive" && "text-destructive",
      )}>
        {value}
      </div>
    </div>
  );
}

function CheckRow({
  label,
  description,
  state,
}: {
  label: string;
  description: string;
  state: "pass" | "fail" | "neutral";
}) {
  const icon =
    state === "pass"    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> :
    state === "fail"    ? <CircleX      className="h-4 w-4 shrink-0 text-destructive" /> :
                          <Minus        className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className={cn(
          "text-sm font-medium",
          state === "fail"    && "text-destructive",
          state === "neutral" && "text-muted-foreground",
        )}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function QualityReportCard({
  report,
  runId,
  onRefreshed,
}: {
  report: QualityReport;
  runId?: string;
  onRefreshed?: (run: RunRecord, report: QualityReport) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function refreshReport() {
    if (!runId) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/runs/${runId}/quality`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not refresh the report.");
      toast.success("Report refreshed.");
      onRefreshed?.(data.run, data.report);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  const evidenceState: "pass" | "fail" | "neutral" =
    report.qualified === 0 ? "neutral" : report.structural_ok ? "pass" : "fail";

  const safetyState: "pass" | "fail" | "neutral" = report.safety_passed ? "pass" : "fail";
  const targetState: "pass" | "fail" | "neutral" = report.meets_target ? "pass" : "fail";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Quality report</CardTitle>
            <CardDescription>Deterministic check — not the model&apos;s opinion.</CardDescription>
          </div>
          {runId && (
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-muted-foreground"
              onClick={refreshReport}
              disabled={refreshing}
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <CountTile
            label="Qualified"
            value={report.qualified}
            highlight={report.qualified >= report.target ? "success" : undefined}
          />
          <CountTile label="Needs review" value={report.needs_review} />
          <CountTile label="Not qualified" value={report.not_qualified} />
          <CountTile
            label="Duplicates"
            value={report.duplicates}
            highlight={report.duplicates > 0 ? "destructive" : undefined}
          />
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <CheckRow
            label={report.meets_target
              ? `Target met — ${report.qualified} of ${report.target} qualified`
              : `Target not met — ${report.qualified} of ${report.target} qualified`}
            description="Whether the run produced enough qualified leads."
            state={targetState}
          />
          <CheckRow
            label={
              evidenceState === "neutral"
                ? "Evidence check — no qualified leads to inspect"
                : report.structural_ok
                  ? "Evidence check passed"
                  : "Evidence check failed — some leads are missing fields or drafts"
            }
            description="Every qualified lead must have evidence, source URLs, summary, and 3 outreach steps."
            state={evidenceState}
          />
          <CheckRow
            label={report.safety_passed ? "Safety check passed" : "Safety check failed"}
            description="No personal emails or unsupported claims found in any draft."
            state={safetyState}
          />
        </div>

        {report.notes.length > 0 && (
          <ul className="space-y-1">
            {report.notes.map((note, i) => (
              <li key={i} className="text-sm text-muted-foreground">{note}</li>
            ))}
          </ul>
        )}

        {(report.unresolved_candidates ?? []).length > 0 && (
          <div className="rounded-lg border p-3">
            <p className="mb-1 text-sm font-medium">
              Candidates without a resolvable website ({report.unresolved_candidates.length})
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              No domain was invented. These cannot be scraped or qualified.
            </p>
            <ul className="space-y-0.5">
              {report.unresolved_candidates.map((c, i) => (
                <li key={i} className="text-xs text-muted-foreground">{c}</li>
              ))}
            </ul>
          </div>
        )}

        {report.issues.length > 0 && (
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-semibold">Issues</p>
            <ul className="space-y-1">
              {report.issues.map((issue, i) => (
                <li key={i} className="text-sm text-muted-foreground">{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

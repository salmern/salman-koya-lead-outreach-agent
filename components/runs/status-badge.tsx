import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RunStatus } from "@/server/types";

const LABELS: Record<RunStatus, string> = {
  draft: "Draft",
  refining: "Refining ICP",
  awaiting_confirmation: "Awaiting confirmation",
  queued: "Queued",
  discovering: "Discovering",
  researching: "Researching",
  qualifying: "Qualifying",
  drafting: "Drafting",
  quality_check: "Quality check",
  completed: "Completed",
  needs_review: "Incomplete",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STYLES: Partial<Record<RunStatus, string>> = {
  completed: "bg-success/15 text-success border-success/30",
  needs_review: "bg-warning/20 text-warning-foreground border-warning/40 dark:text-warning",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  awaiting_confirmation: "bg-primary/10 text-primary border-primary/30",
};

const ACTIVE: RunStatus[] = [
  "refining",
  "queued",
  "discovering",
  "researching",
  "qualifying",
  "drafting",
  "quality_check",
];

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const active = ACTIVE.includes(status);
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap", STYLES[status])}
    >
      {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
      {LABELS[status] ?? status}
    </Badge>
  );
}

export function isActiveStatus(status: RunStatus): boolean {
  return ACTIVE.includes(status);
}
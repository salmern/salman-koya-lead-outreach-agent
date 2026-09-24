import { useEffect, useRef } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock, Wrench } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import type { RunEvent, ToolCall } from "@/lib/types";

interface Item {
  at: string;
  kind: "event" | "tool";
  title: string;
  detail?: string;
  status?: string;
}

function ItemRow({ item }: { item: Item }) {
  const isError   = item.status === "error";
  const isSkipped = item.status === "skipped";
  const isSuccess = item.status === "success";

  return (
    <li className="flex min-w-0 items-start gap-2.5 py-1.5">
      {/* Icon */}
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-background",
          isError   && "border-destructive/50 text-destructive",
          isSkipped && "border-warning/50 text-warning",
          isSuccess && item.kind === "tool" && "border-success/40 text-success",
          !isError && !isSkipped && item.kind === "event" && "border-primary/30 text-primary",
          !isError && !isSkipped && !isSuccess && item.kind === "tool" && "border-border text-muted-foreground",
        )}
      >
        {item.kind === "tool"
          ? isError
            ? <AlertCircle className="h-2.5 w-2.5" />
            : isSuccess
              ? <CheckCircle2 className="h-2.5 w-2.5" />
              : <Wrench className="h-2.5 w-2.5" />
          : <Activity className="h-2.5 w-2.5" />}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "text-xs font-medium capitalize leading-5",
              isError   && "text-destructive",
              isSkipped && "text-warning-foreground",
            )}
          >
            {item.title}
          </span>
          {isError && (
            <span className="rounded bg-destructive/10 px-1 py-0.5 text-[10px] font-medium text-destructive">
              error
            </span>
          )}
          {isSkipped && (
            <span className="rounded bg-warning/10 px-1 py-0.5 text-[10px] font-medium text-warning-foreground">
              skipped
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Clock className="h-2.5 w-2.5" />
            {formatDate(item.at)}
          </span>
        </div>
        {item.detail && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={item.detail}>
            {item.detail}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * ActivityFeed — fixed-height scrollable audit trail.
 *
 * During a live run the pane auto-scrolls to the latest entry so the user
 * always sees what the agent is doing without manual scrolling. Once the run
 * completes the pane is still scrollable to review the full history.
 */
export function ActivityFeed({
  events,
  toolCalls,
}: {
  events: RunEvent[];
  toolCalls: ToolCall[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const items: Item[] = [
    ...events.map((e) => ({
      at: e.created_at,
      kind: "event" as const,
      title: e.event_type.replace(/_/g, " ").toLowerCase(),
      detail: e.message,
    })),
    ...toolCalls.map((c) => ({
      at: c.created_at,
      kind: "tool" as const,
      title: c.tool_name.replace(/^mcp__\w+__/, ""),
      detail: c.result_summary || c.error_message || undefined,
      status: c.status,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Auto-scroll to bottom whenever a new item arrives.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [items.length]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Audit trail
          {items.length > 0 && (
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">
              {items.length}
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Every tool call and agent event — newest at the bottom.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 p-0">
        {items.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <div
            ref={scrollRef}
            className="h-[420px] overflow-y-auto px-4 pb-3"
          >
            <ol className="divide-y divide-border/40">
              {items.map((item, i) => (
                <ItemRow key={i} item={item} />
              ))}
            </ol>
            {/* Scroll anchor — auto-scroll targets this */}
            <div ref={bottomRef} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Building2,
  CheckCircle2,
  CircleX,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ActivityFeed } from "@/components/runs/activity-feed";
import { IcpCard } from "@/components/runs/icp-card";
import { QualityReportCard } from "@/components/runs/quality-report";
import { RunStatusBadge, isActiveStatus } from "@/components/runs/status-badge";
import { OutreachPanel } from "@/components/leads/outreach-panel";
import { cn, formatDate, truncate } from "@/lib/utils";
import type { Lead, OutreachDraft, RunBundle } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────────────
 * Status styling
 * ───────────────────────────────────────────────────────────────────────────── */
const STATUS_BADGE: Record<string, string> = {
  qualified:    "border-success/40 bg-success/10 text-success",
  needs_review: "border-border bg-muted text-muted-foreground",
  not_qualified:"border-border bg-muted/40 text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  qualified:    "Qualified",
  needs_review: "Needs review",
  not_qualified:"Not qualified",
};

/* ─────────────────────────────────────────────────────────────────────────────
 * ReviewRequiredBanner — shown at the top of the run page when the run ended
/* ─────────────────────────────────────────────────────────────────────────────
 * NoMatchBanner — only shown when the run found 0 candidates at all.
 * ───────────────────────────────────────────────────────────────────────────── */
function NoMatchBanner() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <p className="font-semibold">No matching companies found</p>
        <p className="text-sm text-muted-foreground">
          The agent ran 3 discovery searches and couldn&apos;t find companies that pass the
          hard filters. This is usually a search query issue — try a more specific objective,
          a concrete industry niche, or a narrower geography.
        </p>
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href="/runs/new">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Start a new run
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LeadReviewPanel — amber callout for needs_review leads
 * ───────────────────────────────────────────────────────────────────────────── */
function LeadReviewPanel({
  lead,
  onLeadChanged,
}: {
  lead: Lead;
  onLeadChanged: (updated: Lead) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  async function decide(status: "qualified" | "not_qualified") {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { qualificationStatus: status };
      if (note.trim()) {
        body.concerns = [...lead.concerns, `Reviewer note: ${note.trim()}`];
      }
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the review decision.");
      onLeadChanged(data.lead as Lead);
      toast.success(status === "qualified" ? "Lead marked as qualified." : "Lead marked as not qualified.");
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <p className="text-sm font-semibold">Make a decision</p>
      <p className="text-xs text-muted-foreground">
        The agent couldn&apos;t verify all hard filters. Review the evidence above and decide.
      </p>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          Note (optional)
        </Label>
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
          className="resize-none text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => decide("qualified")}
          disabled={saving}
          className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CheckCircle2 className="h-3.5 w-3.5" />}
          Qualify
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => decide("not_qualified")}
          disabled={saving}
          className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CircleX className="h-3.5 w-3.5" />}
          Disqualify
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EvidenceSection — left column: fit reasons, concerns, sources
 * ───────────────────────────────────────────────────────────────────────────── */
function EvidenceSection({ lead }: { lead: Lead }) {
  const muted = lead.qualification_status === "not_qualified";
  return (
    <div className={cn("space-y-5", muted && "opacity-60")}>
      {/* Fit reasons */}
      {lead.fit_reasons.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Why it fits
          </p>
          <ul className="space-y-1">
            {lead.fit_reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Concerns */}
      {lead.concerns.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Concerns
          </p>
          <ul className="space-y-1">
            {lead.concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Source evidence */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence
        </p>
        {lead.source_summary ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{lead.source_summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">No source summary recorded.</p>
        )}
        {lead.source_urls.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {lead.source_urls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {truncate(url, 48)}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * GenerateOutreachButton — shown when a qualified lead has no drafts yet.
 * Fires a targeted agent call (draft only, no re-discovery) and updates the
 * outreach column in place.
 * ───────────────────────────────────────────────────────────────────────────── */
function GenerateOutreachButton({
  leadId,
  onGenerated,
}: {
  leadId: string;
  onGenerated: (drafts: OutreachDraft[]) => void;
}) {
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate outreach.");
      onGenerated(data.drafts as OutreachDraft[]);
      toast.success("Outreach generated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium">No drafts yet</p>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">
        This lead was qualified manually. Generate outreach using the stored source context.
      </p>
      <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
        {generating
          ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
        {generating ? "Generating…" : "Generate outreach"}
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LeadCard — one collapsible card per lead, self-contained.
 * needs_review cards open by default (action required).
 * qualified / not_qualified start collapsed so the list stays scannable.
 * ───────────────────────────────────────────────────────────────────────────── */
function LeadCard({
  lead: initialLead,
  drafts,
  onDraftChanged,
  onLeadChanged,
}: {
  lead: Lead;
  drafts: OutreachDraft[];
  onDraftChanged: (draft: OutreachDraft) => void;
  onLeadChanged: (updated: Lead) => void;
}) {
  const [lead, setLead] = useState(initialLead);
  // needs_review opens by default — it requires action.
  const [open, setOpen] = useState(initialLead.qualification_status === "needs_review");

  function handleLeadUpdated(updated: Lead) {
    setLead(updated);
    onLeadChanged(updated);
  }

  const isNotQualified = lead.qualification_status === "not_qualified";
  const isNeedsReview  = lead.qualification_status === "needs_review";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow",
        isNeedsReview  && "border-border",
        isNotQualified && "opacity-75",
      )}
    >
      {/* ── Clickable header ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full flex-wrap items-start justify-between gap-3 px-5 py-4 text-left transition-colors",
          "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          open && "rounded-b-none border-b",
          isNeedsReview  && open  && "border-b bg-muted/20",
          isNeedsReview  && !open && "bg-muted/20 hover:bg-muted/30",
          isNotQualified           && "bg-muted/30 hover:bg-muted/40",
          !isNeedsReview && !isNotQualified && "bg-muted/20 hover:bg-muted/30",
        )}
      >
        {/* Company info */}
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">{lead.company_name}</h3>
          </div>
          {/* Domain — stopPropagation so clicking the link doesn't toggle the card */}
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={`https://${lead.domain}`}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {lead.domain}
            </a>
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>

        {/* Chips + chevron */}
        <div className="flex items-center gap-2.5">
          {lead.confidence != null && (
            <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium tabular-nums shadow-sm ring-1 ring-border">
              {Math.round(lead.confidence * 100)}% confidence
            </span>
          )}
          <Badge
            variant="outline"
            className={cn("text-xs font-medium capitalize", STATUS_BADGE[lead.qualification_status] ?? "")}
          >
            {STATUS_LABEL[lead.qualification_status] ?? lead.qualification_status.replace(/_/g, " ")}
          </Badge>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* ── Collapsible body ── */}
      {open && (
        <div className="grid grid-cols-1 divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">

          {/* Left: evidence */}
          <div className="space-y-5 p-5">
            <EvidenceSection lead={lead} />

            {/* Review panel — only for needs_review */}
            {isNeedsReview && (
              <>
                <Separator />
                <LeadReviewPanel lead={lead} onLeadChanged={handleLeadUpdated} />
              </>
            )}
          </div>

          {/* Right: outreach */}
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Outreach drafts
            </p>
            {drafts.length === 0 && lead.qualification_status === "qualified" ? (
              <GenerateOutreachButton
                leadId={lead.id}
                onGenerated={(newDrafts) => {
                  newDrafts.forEach((d) => onDraftChanged(d));
                }}
              />
            ) : (
              <OutreachPanel
                drafts={drafts}
                canEdit={true}
                onChanged={onDraftChanged}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LeadsSection — the full leads list within the run detail
 * ───────────────────────────────────────────────────────────────────────────── */
function LeadsSection({
  leads,
  outreach,
  onDraftChanged,
  onLeadChanged,
}: {
  leads: Lead[];
  outreach: Record<string, OutreachDraft[]>;
  onDraftChanged: (draft: OutreachDraft) => void;
  onLeadChanged: (updated: Lead) => void;
}) {
  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No companies have been researched yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Sort: needs_review first (action required), qualified next, not_qualified last.
  const ORDER: Record<string, number> = { needs_review: 0, qualified: 1, not_qualified: 2 };
  const sorted = [...leads].sort(
    (a, b) => (ORDER[a.qualification_status] ?? 3) - (ORDER[b.qualification_status] ?? 3),
  );

  const qualified   = leads.filter((l) => l.qualification_status === "qualified").length;
  const needsReview = leads.filter((l) => l.qualification_status === "needs_review").length;
  const notQualified= leads.filter((l) => l.qualification_status === "not_qualified").length;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Leads
          <span className="text-sm font-normal text-muted-foreground">({leads.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {qualified > 0 && (
            <Badge variant="outline" className={cn("text-xs", STATUS_BADGE.qualified)}>
              {qualified} qualified
            </Badge>
          )}
          {needsReview > 0 && (
            <Badge variant="outline" className={cn("text-xs", STATUS_BADGE.needs_review)}>
              {needsReview} needs review
            </Badge>
          )}
          {notQualified > 0 && (
            <Badge variant="outline" className={cn("text-xs", STATUS_BADGE.not_qualified)}>
              {notQualified} not qualified
            </Badge>
          )}
        </div>
      </div>

      {/* Lead cards */}
      {sorted.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          drafts={outreach[lead.id] ?? []}
          onDraftChanged={onDraftChanged}
          onLeadChanged={onLeadChanged}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * RunDetail — page root
 * ───────────────────────────────────────────────────────────────────────────── */
export function RunDetail({
  initial,
  canManage,
}: {
  initial: RunBundle;
  canManage: boolean;
}) {
  const [bundle, setBundle] = useState<RunBundle>(initial);
  const [cancelling, setCancelling] = useState(false);
  const [showRediscover, setShowRediscover] = useState(false);
  const [rediscoverQuery, setRediscoverQuery] = useState("");
  const [rediscovering, setRediscovering] = useState(false);
  const active = isActiveStatus(bundle.run.status);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${initial.run.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as RunBundle;
      setBundle(data);
    } catch {
      // ignore transient poll errors
    }
  }, [initial.run.id]);

  useEffect(() => {
    if (!active) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(refresh, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active, refresh]);

  const run = bundle.run;
  const qualifiedLeads = bundle.leads.filter((l) => l.qualification_status === "qualified");
  const target   = run.desired_lead_count;
  const progress = target > 0 ? Math.min(100, Math.round((qualifiedLeads.length / target) * 100)) : 0;

  function handleDraftChanged(updated: OutreachDraft) {
    setBundle((prev) => {
      const existing = prev.outreach[updated.lead_id] ?? [];
      const alreadyPresent = existing.some((d) => d.id === updated.id);
      const list = alreadyPresent
        ? existing.map((d) => (d.id === updated.id ? updated : d))
        : [...existing, updated]; // newly generated draft — append it
      return { ...prev, outreach: { ...prev.outreach, [updated.lead_id]: list } };
    });
  }

  function handleLeadChanged(updated: Lead) {
    setBundle((prev) => ({
      ...prev,
      leads: prev.leads.map((l) => (l.id === updated.id ? updated : l)),
    }));
    void refresh();
  }

  async function cancelRun() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel the run.");
      toast.success("Cancellation requested.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setCancelling(false);
    }
  }

  async function refine() {
    try {
      const res = await fetch(`/api/runs/${run.id}/refine`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refinement failed.");
      toast.success("ICP refined.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refinement failed.");
    }
  }

  async function rediscover() {
    if (!rediscoverQuery.trim()) {
      toast.error("Enter a search query before retrying.");
      return;
    }
    setRediscovering(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/rediscover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchQuery: rediscoverQuery.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not re-queue discovery.");
      toast.success("Discovery re-queued with the new search query.");
      setShowRediscover(false);
      setRediscoverQuery("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rediscover failed.");
    } finally {
      setRediscovering(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link href="/dashboard">← Dashboard</Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <RunStatusBadge status={run.status} />
              <span className="text-xs text-muted-foreground">
                Created {formatDate(run.created_at)}
              </span>
            </div>
            <h1 className="max-w-3xl text-xl font-semibold leading-snug tracking-tight">
              {run.original_objective}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {active && (
              <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {canManage && ["draft", "awaiting_confirmation", "failed"].includes(run.status) && (
              <Button variant="outline" size="sm" onClick={refine}>
                {run.status === "draft" ? "Refine ICP" : "Re-refine ICP"}
              </Button>
            )}
            {/* Search again — shown when run finished below target */}
            {canManage &&
              ["needs_review", "completed"].includes(run.status) &&
              qualifiedLeads.length < target && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRediscover((v) => !v)}
                >
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  Search again
                </Button>
              )}
            {canManage && active && (
              <Button variant="outline" size="sm" onClick={cancelRun} disabled={cancelling}>
                {cancelling
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Ban className="mr-1.5 h-3.5 w-3.5" />}
                Cancel
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={`/api/runs/${run.id}/export?format=csv`}>
                    <FileText className="mr-2 h-4 w-4" />Leads CSV
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/runs/${run.id}/export?format=json`}>
                    <FileText className="mr-2 h-4 w-4" />Full run JSON
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/runs/${run.id}/export?format=sample-pack`}>
                    <FileText className="mr-2 h-4 w-4" />Sample pack
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {run.error_message && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{run.error_message}</CardContent>
        </Card>
      )}

      {/* ── Search again panel ───────────────────────────────────────── */}
      {showRediscover && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div>
              <p className="text-sm font-medium">Search again with a different query</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Enter a specific search query. The agent will use it for the first discovery
                attempt instead of deriving one from the ICP. Existing qualified leads are kept.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                className="text-sm"
                placeholder="e.g. B2B SaaS startup scaling operations team United States"
                value={rediscoverQuery}
                onChange={(e) => setRediscoverQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rediscover()}
                disabled={rediscovering}
              />
              <Button size="sm" onClick={rediscover} disabled={rediscovering || !rediscoverQuery.trim()}>
                {rediscovering
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Search className="mr-1.5 h-3.5 w-3.5" />}
                {rediscovering ? "Queueing…" : "Run"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowRediscover(false); setRediscoverQuery(""); }}
                disabled={rediscovering}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── No-match banner (only when 0 leads discovered at all) ─────── */}
      {run.status === "needs_review" &&
        bundle.leads.length === 0 &&
        run.candidate_count === 0 && (
          <NoMatchBanner />
        )}

      {/* ── Active progress ──────────────────────────────────────────── */}
      {active && (
        <Card>
          <CardContent className="space-y-2.5 pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {run.status.replace(/_/g, " ")}…
              </span>
              <span className="tabular-nums text-muted-foreground">
                {qualifiedLeads.length}/{target} qualified
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </CardContent>
        </Card>
      )}

      {/* ── Main layout: 2-col on lg ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        <div className="space-y-6 lg:col-span-2">
          <IcpCard
            run={run}
            onChanged={(updated) => setBundle((prev) => ({ ...prev, run: updated }))}
          />

          {run.quality_report && (
            <QualityReportCard
              report={run.quality_report}
              runId={run.id}
              onRefreshed={(updatedRun, updatedReport) => {
                setBundle((prev) => ({
                  ...prev,
                  run: { ...updatedRun, quality_report: updatedReport },
                }));
              }}
            />
          )}

          <LeadsSection
            leads={bundle.leads}
            outreach={bundle.outreach}
            onDraftChanged={handleDraftChanged}
            onLeadChanged={handleLeadChanged}
          />

          {run.pending_candidates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Discovery pool — {run.pending_candidates.length} candidate
                  {run.pending_candidates.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {run.pending_candidates.map((c) => (
                    <Badge
                      key={`${c.company_domain || "w"}-${c.linkedin_url || "l"}-${c.company_name}`}
                      variant="secondary"
                      className="font-normal"
                    >
                      {c.company_name}
                      {c.company_domain
                        ? <span className="ml-1 opacity-60">· {c.company_domain}</span>
                        : <span className="ml-1 opacity-40">· unresolved</span>}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <div className="lg:sticky lg:top-4">
            <ActivityFeed events={bundle.events} toolCalls={bundle.toolCalls} />
          </div>
        </div>

      </div>
    </div>
  );
}

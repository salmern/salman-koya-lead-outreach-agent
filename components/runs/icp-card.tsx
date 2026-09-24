"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Pencil, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { RefinedIcp, RunRecord } from "@/lib/types";

function toLines(items: string[]): string {
  return items.join("\n");
}

function fromLines(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * IcpField — renders one labelled row in view mode.
 * Scalar values are plain text; array values wrap as badge chips.
 * Both are constrained to their grid cell — no horizontal bleed.
 * ───────────────────────────────────────────────────────────────────────────── */
function IcpField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string | string[];
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0">
        {Array.isArray(value) ? (
          value.length ? (
            /* Wrap chips — they never overflow their column */
            <div className="flex flex-wrap gap-1.5">
              {value.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="max-w-full truncate font-normal"
                  title={item}
                >
                  {item}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )
        ) : (
          /* Long scalar text wraps within the cell */
          <p className="break-words text-sm leading-relaxed">{value || "None"}</p>
        )}
      </dd>
    </div>
  );
}

function IcpView({ icp }: { icp: RefinedIcp }) {
  return (
    <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
      <IcpField label="Company type" value={icp.target_company_type} />
      <IcpField label="Headcount"    value={icp.headcount_range} />
      <IcpField label="Industries"   value={icp.industries} />
      <IcpField label="Geography"    value={icp.geography} />
      <IcpField label="Buyer persona"  value={icp.buyer_persona}    wide />
      <IcpField label="Business problem" value={icp.business_problem} wide />
      <IcpField label="Hard filters"     value={icp.hard_filters}    wide />
      <IcpField label="Soft preferences" value={icp.soft_preferences} wide />
      <IcpField label="Disqualifiers"    value={icp.disqualifiers}   wide />
    </dl>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EditField helpers — keep the form DRY and consistent
 * ───────────────────────────────────────────────────────────────────────────── */
function EditInput({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" />
    </div>
  );
}

function EditTextarea({
  label,
  hint,
  value,
  onChange,
  rows = 3,
  wide,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        {hint && (
          <span className="ml-1.5 text-xs font-normal normal-case text-muted-foreground/70">
            {hint}
          </span>
        )}
      </div>
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-none text-sm"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * IcpCard — the main exported component
 * ───────────────────────────────────────────────────────────────────────────── */
export function IcpCard({
  run,
  onChanged,
}: {
  run: RunRecord;
  onChanged: (run: RunRecord) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [starting, setStarting] = useState(false);
  const icp = run.refined_icp;

  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    target_company_type: icp?.target_company_type ?? "",
    industries:          toLines(icp?.industries ?? []),
    geography:           toLines(icp?.geography ?? []),
    headcount_range:     icp?.headcount_range ?? "",
    buyer_persona:       icp?.buyer_persona ?? "",
    business_problem:    icp?.business_problem ?? "",
    hard_filters:        toLines(icp?.hard_filters ?? []),
    soft_preferences:    toLines(icp?.soft_preferences ?? []),
    disqualifiers:       toLines(icp?.disqualifiers ?? []),
  }));

  const set = (key: string) => (v: string) => setDraft((d) => ({ ...d, [key]: v }));

  const awaiting = run.status === "awaiting_confirmation";
  const fallback = Boolean(run.agent_metadata?.icp_fallback);

  async function save() {
    setSaving(true);
    try {
      const refinedIcp: RefinedIcp = {
        target_company_type: draft.target_company_type.trim(),
        industries:          fromLines(draft.industries),
        geography:           fromLines(draft.geography),
        headcount_range:     draft.headcount_range.trim(),
        buyer_persona:       draft.buyer_persona.trim(),
        business_problem:    draft.business_problem.trim(),
        hard_filters:        fromLines(draft.hard_filters),
        soft_preferences:    fromLines(draft.soft_preferences),
        disqualifiers:       fromLines(draft.disqualifiers),
      };
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refinedIcp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the ICP.");
      toast.success("ICP saved.");
      onChanged(data.run);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmStart() {
    setStarting(true);
    try {
      const res = await fetch(`/api/runs/${run.id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the run.");
      toast.success("Run queued. Research is starting.");
      onChanged(data.run);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Start failed.");
    } finally {
      setStarting(false);
    }
  }

  // No ICP yet and not currently refining — nothing to show.
  if (!icp && !["draft", "refining"].includes(run.status)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Refined ICP</CardTitle>
          <CardDescription>No ICP has been recorded for this run.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            Refined ICP
          </CardTitle>
          <CardDescription className="mt-0.5">
            {awaiting
              ? "Review and confirm before discovery runs. Every field is a constraint the agent must respect."
              : "The confirmed ideal customer profile for this run."}
          </CardDescription>
        </div>
        {awaiting && !editing && (
          <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Fallback notice */}
        {fallback && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            ICP produced by deterministic fallback (Anthropic not configured). Review carefully before confirming.
          </div>
        )}

        {/* Loading state */}
        {!icp && ["draft", "refining"].includes(run.status) && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Refining the ICP…
          </div>
        )}

        {/* Edit form */}
        {icp && editing && (
          <div className="grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2">
            <EditInput label="Company type"  value={draft.target_company_type} onChange={set("target_company_type")} />
            <EditInput label="Headcount"     value={draft.headcount_range}     onChange={set("headcount_range")} />
            <EditTextarea label="Industries"  hint="one per line"  value={draft.industries}   onChange={set("industries")} />
            <EditTextarea label="Geography"   hint="one per line"  value={draft.geography}    onChange={set("geography")} />
            <EditInput    label="Buyer persona" value={draft.buyer_persona} onChange={set("buyer_persona")} wide />
            <EditTextarea label="Business problem" value={draft.business_problem} onChange={set("business_problem")} rows={2} wide />
            <EditTextarea label="Hard filters"     hint="one per line" value={draft.hard_filters}    onChange={set("hard_filters")} wide />
            <EditTextarea label="Soft preferences" hint="one per line" value={draft.soft_preferences} onChange={set("soft_preferences")} wide />
            <EditTextarea label="Disqualifiers"    hint="one per line" value={draft.disqualifiers}   onChange={set("disqualifiers")} rows={2} wide />

            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save changes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* View mode */}
        {icp && !editing && <IcpView icp={icp} />}

        {/* Confirm & start bar — only while awaiting confirmation */}
        {awaiting && !editing && icp && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Starts discovery, qualification and outreach drafting.
              </p>
              <Button size="sm" onClick={confirmStart} disabled={starting}>
                {starting
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                Confirm &amp; start research
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

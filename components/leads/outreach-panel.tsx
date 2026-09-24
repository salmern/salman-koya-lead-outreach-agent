"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Mail, Pencil, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { OutreachDraft } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-muted text-muted-foreground border-muted-foreground/30",
  reviewed: "bg-primary/10 text-primary border-primary/30",
  approved: "bg-success/15 text-success border-success/40",
  rejected: "bg-destructive/10 text-destructive border-destructive/40",
};

const STATUS_LABEL: Record<string, string> = {
  draft:    "Draft",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Needs edit",
};

function hasPlaceholders(text: string): boolean {
  return /\[[^\]]{2,40}\]/.test(text);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Button size="sm" variant="ghost" onClick={copy} title="Copy">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function DraftEditor({
  draft,
  canEdit,
  onSaved,
}: {
  draft: OutreachDraft;
  canEdit: boolean;
  onSaved: (draft: OutreachDraft) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [note, setNote] = useState(draft.personalization_note);

  const isRejected = draft.review_status === "rejected";
  const isApproved = draft.review_status === "approved";
  const fullText = `${draft.subject}\n\n${draft.body}`;
  const needsPlaceholderFix = hasPlaceholders(draft.subject) || hasPlaceholders(draft.body);

  async function patchDraft(payload: Record<string, unknown>) {
    const res = await fetch(`/api/outreach/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not update the draft.");
    return data.outreach as OutreachDraft;
  }

  async function saveEdits() {
    setSaving(true);
    try {
      const updated = await patchDraft({ subject, body, personalizationNote: note, reviewStatus: "reviewed" });
      onSaved(updated);
      setEditing(false);
      toast.success("Draft saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "draft" | "approved" | "rejected") {
    setSaving(true);
    try {
      const updated = await patchDraft({ reviewStatus: status });
      onSaved(updated);
      toast.success(status === "approved" ? "Approved." : status === "rejected" ? "Rejected." : "Reopened.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          Email {draft.sequence_step}
          <Badge variant="outline" className={`text-xs ${STATUS_STYLES[draft.review_status] ?? STATUS_STYLES.draft}`}>
            {STATUS_LABEL[draft.review_status] ?? draft.review_status}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {!editing && <CopyButton text={fullText} />}
          {canEdit && (
            <>
              {isApproved ? (
                <Button size="sm" variant="ghost" onClick={() => setStatus("draft")} disabled={saving}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Reopen
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setStatus("approved")} disabled={saving}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Approve
                </Button>
              )}
              {!isRejected && (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setStatus("rejected")} disabled={saving}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
              )}
              {isRejected && (
                <Button size="sm" variant="ghost" onClick={() => setStatus("draft")} disabled={saving}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Reopen
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} disabled={saving}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {editing ? "Cancel" : "Edit"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Placeholder notice — no extra Edit button, header already has one */}
      {needsPlaceholderFix && !editing && (
        <div className="border-b bg-muted/20 px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Contains unfilled placeholders like{" "}
            <span className="font-mono">[First Name]</span>. Use Edit to replace them.
          </p>
        </div>
      )}

      {/* Edit form */}
      {canEdit && editing ? (
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Subject</Label>
            <Textarea rows={2} value={subject} onChange={(e) => setSubject(e.target.value)} className="resize-none text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Body</Label>
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} className="resize-none text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Personalization note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdits} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 p-4">
          <p className="text-sm font-medium">{draft.subject}</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">{draft.body}</pre>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium">Note:</span> {draft.personalization_note}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * LinkedIn message — shown below the email steps.
 * Supports editing if canEdit is true.
 */
function LinkedInEditor({
  message,
  draftId,
  canEdit,
  onSaved,
}: {
  message: string;
  draftId: string;
  canEdit: boolean;
  onSaved: (updated: OutreachDraft) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState(message);
  const needsPlaceholderFix = hasPlaceholders(message);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/outreach/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinMessage: text, reviewStatus: "reviewed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update.");
      onSaved(data.outreach as OutreachDraft);
      setEditing(false);
      toast.success("LinkedIn message saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn message</p>
        <div className="flex items-center gap-1">
          {!editing && <CopyButton text={message} />}
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} disabled={saving}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
        </div>
      </div>

      {needsPlaceholderFix && !editing && (
        <p className="mb-2 text-xs text-muted-foreground">
          Contains unfilled placeholders. Use Edit to replace them.
        </p>
      )}

      {canEdit && editing ? (
        <div className="space-y-2">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="resize-none text-sm" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">{message}</pre>
      )}
    </div>
  );
}

export function OutreachPanel({
  drafts,
  canEdit,
  onChanged,
}: {
  drafts: OutreachDraft[];
  canEdit: boolean;
  onChanged: (draft: OutreachDraft) => void;
}) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm font-medium">No drafts yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Outreach is drafted during the run for qualified leads. If you qualified this lead
          after the run completed, use the Generate outreach button above.
        </p>
      </div>
    );
  }

  const sorted = [...drafts].sort((a, b) => a.sequence_step - b.sequence_step);
  const step1 = sorted.find((d) => d.sequence_step === 1);
  const linkedin = step1?.linkedin_message;

  return (
    <div className="space-y-3">
      {sorted.map((draft) => (
        <DraftEditor key={draft.id} draft={draft} canEdit={canEdit} onSaved={onChanged} />
      ))}
      {linkedin && step1 && (
        <>
          <Separator />
          <LinkedInEditor
            message={linkedin}
            draftId={step1.id}
            canEdit={canEdit}
            onSaved={onChanged}
          />
        </>
      )}
    </div>
  );
}

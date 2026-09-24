import { notFound } from "next/navigation";

import { RunDetail } from "@/components/runs/run-detail";
import { requireUser } from "@/server/auth";
import type { OutreachRow } from "@/server/db";
import {
  getRunForViewer,
  listEventsForViewer,
  listLeadsForViewer,
  listOutreachForViewer,
  listToolCallsForViewer,
} from "@/server/user-db";
import type { RunBundle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const run = await getRunForViewer(id);
  if (!run) notFound();

  const [leads, toolCalls, events] = await Promise.all([
    listLeadsForViewer(id),
    listToolCallsForViewer(id),
    listEventsForViewer(id),
  ]);
  const outreach = await listOutreachForViewer(leads.map((l) => l.id));

  const outreachMap: Record<string, OutreachRow[]> = {};
  for (const draft of outreach) {
    (outreachMap[draft.lead_id] ??= []).push(draft);
  }

  const bundle: RunBundle = {
    run,
    leads: leads as unknown as RunBundle["leads"],
    outreach: outreachMap as unknown as RunBundle["outreach"],
    toolCalls: toolCalls as unknown as RunBundle["toolCalls"],
    events: events as unknown as RunBundle["events"],
  };

  return <RunDetail initial={bundle} canManage={true} />;
}
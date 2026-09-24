import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NewRunForm } from "@/components/runs/new-run-form";

export const dynamic = "force-dynamic";

export default function NewRunPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New research run</h1>
        <p className="text-sm text-muted-foreground">
          Step 1 of 3 — describe the objective. The agent refines it into a concrete ICP which you
          confirm before any discovery runs.
        </p>
      </div>
      <NewRunForm />
    </div>
  );
}
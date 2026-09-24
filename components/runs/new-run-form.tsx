"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  objective: z
    .string()
    .trim()
    .min(20, "Describe the objective in at least 20 characters.")
    .max(4000),
  desiredLeadCount: z.string(),
  industries: z.string().optional(),
  geography: z.string().optional(),
  headcount: z.string().optional(),
  buyer: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function NewRunForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      objective: "",
      desiredLeadCount: "10",
      industries: "",
      geography: "",
      headcount: "",
      buyer: "",
    },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    try {
      const overrides: Record<string, string> = {};
      if (values.industries?.trim()) overrides.industries = values.industries.trim();
      if (values.geography?.trim()) overrides.geography = values.geography.trim();
      if (values.headcount?.trim()) overrides.headcount_range = values.headcount.trim();
      if (values.buyer?.trim()) overrides.buyer_persona = values.buyer.trim();

      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: values.objective,
          desiredLeadCount: Number(values.desiredLeadCount),
          overrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the run.");

      toast.success("Run created. Refining the ICP…");
      const runId = data.run.id as string;

      const refine = await fetch(`/api/runs/${runId}/refine`, { method: "POST" });
      const refineData = await refine.json();
      if (!refine.ok) {
        toast.error(refineData.error ?? "ICP refinement failed. You can retry from the run page.");
      }
      router.push(`/runs/${runId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qualification objective</CardTitle>
          <CardDescription>
            Describe the companies you want to find. Include hard constraints like geography,
            size, or business model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="objective">Objective</Label>
            <Textarea
              id="objective"
              rows={5}
              {...form.register("objective")}
            />
            {form.formState.errors.objective && (
              <p className="text-sm text-destructive">{form.formState.errors.objective.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="desiredLeadCount">Target qualified leads</Label>
            <Select
              value={form.watch("desiredLeadCount")}
              onValueChange={(v) => form.setValue("desiredLeadCount", v)}
            >
              <SelectTrigger id="desiredLeadCount" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["5", "10", "15", "20"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n} leads
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A target, not a quota. Fewer strong leads are better than a padded list.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overrides (optional)</CardTitle>
          <CardDescription>
            Treated as hard constraints during ICP refinement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="industries">Industries</Label>
            <Input id="industries" {...form.register("industries")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geography">Geography</Label>
            <Input id="geography" {...form.register("geography")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headcount">Headcount range</Label>
            <Input id="headcount" {...form.register("headcount")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer">Buyer persona</Label>
            <Input id="buyer" {...form.register("buyer")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Refine ICP
        </Button>
      </div>
    </form>
  );
}

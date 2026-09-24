import { z } from "zod";

import { handle, json, readJson } from "@/server/api";
import { requireUser } from "@/server/auth";
import { createClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

const schema = z.object({
  fullName: z.string().trim().min(1).max(120),
});

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { fullName } = schema.parse(await readJson(request));
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) throw new Error(error.message);
    return json({ ok: true, fullName });
  });
}
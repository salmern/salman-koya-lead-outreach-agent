import { z } from "zod";

import { apiError, handle, json, readJson } from "@/server/api";
import { requireRole } from "@/server/auth";
import { listProfiles, setUserRole } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireRole("admin");
    const users = await listProfiles();
    return json({ users });
  });
}

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "researcher", "viewer"]),
});

export async function PATCH(request: Request) {
  return handle(async () => {
    const admin = await requireRole("admin");
    const body = patchSchema.parse(await readJson(request));

    if (body.userId === admin.id) {
      return apiError("You cannot change your own role.", 400);
    }

    const user = await setUserRole(body.userId, body.role);
    if (!user) return apiError("Could not update the user role.", 500);
    return json({ user });
  });
}
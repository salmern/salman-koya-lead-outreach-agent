import { handle, json } from "@/server/api";
import { getSessionUser } from "@/server/auth";
import { isExternalIntegrationConfigured } from "@/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    return json({
      user,
      integrations: isExternalIntegrationConfigured(),
    });
  });
}
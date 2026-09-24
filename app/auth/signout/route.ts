import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/server/supabase";

/** Signs the user out and returns them to the login screen. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
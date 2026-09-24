import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · Koya Lead Agent" };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in to your workspace.</p>
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign up · Koya Lead Agent" };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
        <p className="text-sm text-muted-foreground">
          New accounts start as researchers. An admin can adjust your role.
        </p>
      </div>
      <AuthForm mode="signup" />
    </div>
  );
}
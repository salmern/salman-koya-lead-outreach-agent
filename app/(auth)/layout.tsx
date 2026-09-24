import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-primary via-primary to-chart-2 p-10 text-primary-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5" />
          Koya Lead Agent
        </Link>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Evidence-backed leads.
            <br />
            Human-reviewed outreach.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Refine your ICP, discover companies, qualify them against hard filters, and draft a
            3-step sequence — with every claim traceable to a source.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">
          Outreach stays in review. Nothing is ever sent automatically.
        </p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
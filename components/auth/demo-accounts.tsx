"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { DEMO_USERS, type DemoUser } from "@/lib/demo-users";

const ROLE_STYLE: Record<DemoUser["role"], { avatar: string; ring: string }> = {
  admin: {
    avatar: "from-amber-400 to-orange-600",
    ring: "hover:border-amber-500/60 hover:shadow-amber-500/10",
  },
  researcher: {
    avatar: "from-sky-400 to-blue-600",
    ring: "hover:border-sky-500/60 hover:shadow-sky-500/10",
  },
};

export function DemoAccounts({ onPick }: { onPick: (demo: DemoUser) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mx-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Sparkles className="h-4 w-4 text-amber-500 transition-transform group-hover:rotate-12" />
        Explore with a demo account
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {DEMO_USERS.map((demo) => {
          const style = ROLE_STYLE[demo.role];
          return (
            <button
              key={demo.role}
              type="button"
              onClick={() => onPick(demo)}
              className={`group flex flex-col items-center gap-1.5 rounded-xl border bg-muted/30 p-3 text-center transition hover:shadow-sm ${style.ring}`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-sm ${style.avatar}`}
              >
                {demo.role.slice(0, 2)}
              </span>
              <span className="text-sm font-medium capitalize leading-none">{demo.role}</span>
              <span className="text-xs leading-tight text-muted-foreground">{demo.description}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Collapse
        </button>
      </div>
    </div>
  );
}

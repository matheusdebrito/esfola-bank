import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(
    "flex h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm shadow-slate-900/[.02] outline-none transition-colors placeholder:text-muted-foreground/75 hover:border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )} {...props} />;
}

import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}
export function Select({ className, children, value, onValueChange, ...props }: SelectProps) {
  return <select className={cn(
    "flex h-11 w-full min-w-0 items-center rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm shadow-slate-900/[.02] outline-none transition-colors hover:border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )} value={value ?? ""} onChange={(event) => onValueChange?.(event.target.value)} {...props}>{children}</select>;
}
export function SelectTrigger(_props: { children?: React.ReactNode }): null { return null; }
export function SelectValue(_props: { children?: React.ReactNode }): null { return null; }
export function SelectContent({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function SelectItem({ children, value, ...props }: { value?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLOptionElement>) {
  return <option value={value} {...props}>{children}</option>;
}
export function SelectSeparator() { return <hr />; }

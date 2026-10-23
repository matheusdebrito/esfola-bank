"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:p-6 sm:shadow-lg">
        {children}
      </div>
    </>
  );
}
export function DialogTrigger({ children }: { children: React.ReactNode }) { return children; }
export function DialogContent({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function DialogHeader({ children }: { children: React.ReactNode }) { return <div className="flex flex-col space-y-1.5">{children}</div>; }
export function DialogTitle({ children }: { children: React.ReactNode }) { return <h3 className="text-xl font-semibold">{children}</h3>; }
export function DialogDescription({ children }: { children: React.ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }
export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("mt-4 flex items-center justify-end gap-2", className)}>{children}</div>; }

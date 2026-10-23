import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);
  const headingId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const selector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]";
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(selector) ?? []);
    (focusables()[1] ?? panel)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
      if (event.key === "Tab") {
        const elements = focusables();
        if (!elements.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5">
    <button type="button" aria-label="Fechar janela" className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]" onClick={() => onOpenChange(false)} />
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}
      className="relative z-10 flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-3xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl outline-none sm:max-h-[90dvh] sm:rounded-2xl sm:p-6">
      <button type="button" aria-label="Fechar" onClick={() => onOpenChange(false)}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="pr-9" id={headingId}>{children}</div>
    </div>
  </div>;
}
export function DialogTrigger({ children }: { children: React.ReactNode }) { return children; }
export function DialogContent({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5 border-b border-border/60 pb-4">{children}</div>;
}
export function DialogTitle({ children }: { children: React.ReactNode }) { return <h3 className="text-xl font-semibold tracking-tight">{children}</h3>; }
export function DialogDescription({ children }: { children: React.ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }
export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4", className)}>{children}</div>;
}

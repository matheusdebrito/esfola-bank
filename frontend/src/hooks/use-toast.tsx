"use client";

import * as React from "react";

type ToastProps = { id: string; title?: string; description?: string; variant?: "default" | "destructive" };
interface Ctx { toasts: ToastProps[]; toast: (p: Omit<ToastProps, "id">) => string; dismiss: (id?: string) => void; }
const Ctx = React.createContext<Ctx | null>(null);
let id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);
  const toast = React.useCallback((p: Omit<ToastProps, "id">) => {
    const i = (++id).toString();
    setToasts((prev) => [...prev, { ...p, id: i }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== i)), 5000);
    return i;
  }, []);
  const dismiss = React.useCallback((i?: string) => setToasts((prev) => (i ? prev.filter((t) => t.id !== i) : [])), []);
  return <Ctx.Provider value={{ toasts, toast, dismiss }}>{children}</Ctx.Provider>;
}
export function useToast() { const c = React.useContext(Ctx); if (!c) throw new Error("useToast inside ToastProvider"); return c; }
export function Toast({ id, title, description, variant = "default" }: ToastProps) {
  return (
    <div role="alert" className={`flex w-full max-w-sm flex-col gap-2 pointer-events-auto ${variant === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-background text-foreground"}`}>
      <div className="flex items-start gap-3 p-4 rounded-lg border border-border shadow-lg">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="text-[10px] text-primary-foreground font-bold">{variant === "destructive" ? "!" : "i"}</span>
        </div>
        <div className="flex flex-col gap-1">{title && <h4 className="text-sm font-semibold">{title}</h4>}{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
      </div>
    </div>
  );
}
export function Toaster() { const { toasts, dismiss } = useToast(); (window as any).__dismiss = dismiss; return (<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">{toasts.map((t) => <Toast key={t.id} {...t} />)}</div>); }

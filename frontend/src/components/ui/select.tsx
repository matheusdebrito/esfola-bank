import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function Select({ className, children, value, onValueChange, ...props }: SelectProps) {
  return (
    <select
      className={cn("flex h-11 w-full items-center sm:h-10 justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
      value={value || ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * Wrapper de `select` nativo.
 *
 * A composição `SelectTrigger`/`SelectContent`/`SelectItem` é mantida apenas
 * por compatibilidade: o gatilho e o valor não devem renderizar elementos
 * dentro de um `<select>` (HTML inválido). Os itens viram `<option>`.
 */
export function SelectTrigger(_props: { children?: React.ReactNode }): null {
  return null;
}

export function SelectValue(_props: { children?: React.ReactNode }): null {
  return null;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectItem({ children, value, ...props }: { value?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLOptionElement>) {
  return <option value={value} {...props}>{children}</option>;
}

export function SelectSeparator() {
  return <hr />;
}

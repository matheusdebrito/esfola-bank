import * as React from "react";
import { cn } from "@/lib/utils";
export function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return <hr className={cn("shrink-0 border-border", orientation === "horizontal" ? "h-[1px] w-full" : "w-[1px] h-full", className)} />;
}

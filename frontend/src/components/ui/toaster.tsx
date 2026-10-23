"use client";

import * as React from "react";
import { Toaster } from "@/hooks/use-toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <>{children}<Toaster /></>;
}

import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}
const variants: Record<string, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};
const sizes: Record<string, string> = {
  default: "h-11 px-4 py-2 sm:h-10",
  sm: "h-10 px-3 sm:h-9",
  lg: "h-12 px-8 sm:h-11",
  icon: "h-11 w-11 sm:h-10 sm:w-10",
};
export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />
  );
}

import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "accent" | "outline" | "subtle";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const base = "inline-flex items-center font-medium rounded tracking-wide select-none";

  const variants = {
    default: "bg-white/[0.06] text-neutral-300 border border-white/10",
    subtle: "bg-black/40 text-neutral-400 border border-white/5",
    success: "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40",
    warning: "bg-amber-950/40 text-amber-300 border border-amber-800/40",
    danger: "bg-rose-950/40 text-rose-300 border border-rose-800/40",
    accent: "bg-[#DCA744]/15 text-[#FCD34D] border border-[#DCA744]/30",
    outline: "bg-transparent text-neutral-400 border border-white/15",
  };

  const sizes = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-0.5 gap-1.5",
  };

  return (
    <div className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </div>
  );
}

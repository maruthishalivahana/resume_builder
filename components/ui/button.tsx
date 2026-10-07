import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

    const variants = {
      primary:
        "bg-white text-black hover:bg-neutral-200 active:scale-[0.98] shadow-sm font-semibold",
      secondary:
        "bg-[#141414] text-[#EDEDED] border border-white/10 hover:bg-[#1C1C1C] hover:border-white/20 active:scale-[0.98]",
      outline:
        "bg-transparent text-[#EDEDED] border border-white/10 hover:bg-white/[0.04] hover:border-white/20 active:scale-[0.98]",
      ghost:
        "bg-transparent text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-white/[0.05] active:scale-[0.98]",
      danger:
        "bg-rose-950/40 text-rose-300 border border-rose-800/30 hover:bg-rose-900/50 active:scale-[0.98]",
      accent:
        "bg-[#DCA744]/15 text-[#FCD34D] border border-[#DCA744]/30 hover:bg-[#DCA744]/25 hover:border-[#DCA744]/50 active:scale-[0.98]",
    };

    const sizes = {
      sm: "text-xs px-2.5 py-1.5 rounded-md gap-1.5",
      md: "text-xs px-3.5 py-2 rounded-lg gap-2",
      lg: "text-sm px-4.5 py-2.5 rounded-lg gap-2.5 font-semibold",
      icon: "h-8 w-8 rounded-md p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

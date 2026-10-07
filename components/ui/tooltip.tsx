import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, shortcut, children, side = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const sidePositions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded bg-[#18181B] px-2 py-1 text-[11px] font-medium text-neutral-200 shadow-xl border border-white/10 transition-opacity duration-100",
            sidePositions[side]
          )}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="rounded bg-white/10 px-1 py-0.2 font-mono text-[9px] text-neutral-400">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
}

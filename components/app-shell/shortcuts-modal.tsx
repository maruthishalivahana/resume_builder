"use client";

import React from "react";
import { X, Command } from "lucide-react";
import { useResume } from "@/hooks/use-resume";

export function ShortcutsModal() {
  const { isShortcutsOpen, setIsShortcutsOpen } = useResume();

  if (!isShortcutsOpen) return null;

  const shortcuts = [
    { label: "Toggle Left Sidebar", keys: ["⌘", "B"] },
    { label: "Open Command Palette", keys: ["⌘", "K"] },
    { label: "Toggle AI Copilot", keys: ["✦", "AI"] },
    { label: "Compile LaTeX Document", keys: ["⌘", "↵"] },
    { label: "Close Drawers & Modals", keys: ["Esc"] },
    { label: "Export PDF", keys: ["⌘", "P"] },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={() => setIsShortcutsOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#0E0E12] shadow-2xl overflow-hidden text-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#121216]">
          <div className="flex items-center gap-2">
            <Command className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={() => setIsShortcutsOpen(false)}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02] text-xs"
            >
              <span className="text-neutral-300">{sc.label}</span>
              <div className="flex items-center gap-1">
                {sc.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-2 py-0.5 rounded bg-[#1A1A20] border border-white/10 font-mono text-[10px] text-neutral-300"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#09090C] text-[10px] text-neutral-500 font-mono flex items-center justify-between">
          <span>RESUME.ENG Workspace</span>
          <span>Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Code2,
  ShieldCheck,
  Download,
  Command,
  Check,
  Loader2,
  Sparkles,
  Layers,
  Eye,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const pathname = usePathname();
  const { resume, saveStatus, isAIAssistantOpen, toggleAIAssistant } = useResume();

  const isEditor = pathname.includes("/editor");
  const isLatex = pathname.includes("/latex");
  const isPreview = pathname.includes("/preview");
  const isATS = pathname.includes("/ats");

  return (
    <header className="sticky top-0 z-40 h-13 border-b border-white/[0.08] bg-[#0A0A0C]/90 backdrop-blur-md px-4 flex items-center justify-between select-none">
      {/* Left: Brand + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 group focus:outline-none"
        >
          <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400/20 to-sky-400/20 border border-white/20 flex items-center justify-center font-mono text-[11px] font-bold text-white group-hover:border-amber-400/50 transition-colors">
            R
          </div>
          <span className="font-semibold text-xs tracking-wider text-neutral-200 group-hover:text-white transition-colors">
            RESUME<span className="text-amber-400/90 font-mono">.ENG</span>
          </span>
        </Link>

        <span className="text-neutral-600 text-xs">/</span>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3 h-3 text-neutral-500" />
            <span className="hidden sm:inline">Workspace</span>
          </Link>

          <span className="text-neutral-700 text-xs">/</span>

          <span className="text-xs font-medium text-neutral-200 truncate max-w-[140px] md:max-w-[220px]">
            {resume.name}
          </span>
        </div>

        {/* Dynamic Save Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 pl-2 text-[11px] text-neutral-500">
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-neutral-500">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Mode Switcher Tabs (Strict Top Nav Architecture) */}
      <div className="hidden md:flex items-center p-1 rounded-lg bg-black/50 border border-white/[0.06] text-xs">
        <Link
          href="/resume/demo/editor"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            isEditor
              ? "bg-[#1C1C1F] text-white shadow-sm font-medium border border-white/10"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Editor</span>
        </Link>

        <Link
          href="/resume/demo/latex"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            isLatex
              ? "bg-[#1C1C1F] text-white shadow-sm font-medium border border-white/10"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-sky-400" />
          <span>LaTeX</span>
        </Link>

        <Link
          href="/resume/demo/preview"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            isPreview
              ? "bg-[#1C1C1F] text-white shadow-sm font-medium border border-white/10"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Preview</span>
        </Link>

        <Link
          href="/resume/demo/ats"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            isATS
              ? "bg-[#1C1C1F] text-white shadow-sm font-medium border border-white/10"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>ATS Analysis</span>
          <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-400/15 text-emerald-300 font-mono font-bold">
            87
          </span>
        </Link>

        {/* Dedicated ✦ AI Action Trigger */}
        <button
          onClick={toggleAIAssistant}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
            isAIAssistantOpen
              ? "bg-amber-400/20 text-amber-200 shadow-sm font-medium border border-amber-400/40"
              : "text-amber-400 hover:text-amber-200 hover:bg-amber-400/10"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-medium">✦ AI</span>
        </button>
      </div>

      {/* Right: Quick Command trigger & Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const event = new KeyboardEvent("keydown", {
              key: "k",
              metaKey: true,
              bubbles: true,
            });
            window.dispatchEvent(event);
          }}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#141416] border border-white/10 text-neutral-400 hover:text-neutral-200 hover:border-white/20 transition-all text-xs"
        >
          <Command className="w-3.5 h-3.5 text-neutral-500" />
          <span className="font-mono text-[11px]">⌘K</span>
        </button>

        <Link href="/resume/demo/preview">
          <Button variant="primary" size="sm">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}

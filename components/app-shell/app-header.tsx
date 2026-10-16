"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeft,
  Download,
  Check,
  Loader2,
  ChevronRight,
  Layers,
  Play,
  RotateCw,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const pathname = usePathname();
  const {
    resumeBasePath,
    resume,
    saveStatus,
    toggleSidebar,
    isSidebarCollapsed,
    isCompiling,
    compileLatex,
    entryFileId,
    compileTargetId,
    files,
  } = useResume();

  const isLatexPage = pathname.includes("/latex");

  const getSectionTitle = () => {
    if (pathname.includes("/editor"))   return "Editor";
    if (pathname.includes("/latex"))    return "LaTeX IDE";
    if (pathname.includes("/preview"))  return "PDF Preview";
    if (pathname.includes("/ats"))      return "ATS Diagnostics";
    if (pathname.includes("/versions")) return "Versions";
    if (pathname.includes("/jobs"))     return "Job Targets";
    if (pathname.includes("/settings")) return "Settings";
    return "Overview";
  };

  return (
    <header className="h-14 shrink-0 border-b border-white/[0.07] bg-[#0A0A0D]/90 backdrop-blur-md px-4 flex items-center justify-between select-none z-20">
      {/* Left: Sidebar Toggle + Breadcrumb */}
      <div className="flex items-center gap-3">
        {isSidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Expand sidebar (⌘B)"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link
            href={`${resumeBasePath}/overview`}
            className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Workspace</span>
          </Link>

          <ChevronRight className="w-3 h-3 text-neutral-600" />

          <span className="text-neutral-300 font-medium truncate max-w-[140px] md:max-w-[200px]">
            {resume.name}
          </span>

          <ChevronRight className="w-3 h-3 text-neutral-600" />

          <span className="text-white font-semibold">{getSectionTitle()}</span>
        </div>
      </div>

      {/* Right: Saved + Compile (LaTeX only) + Export PDF + Avatar */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Save indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>Saving...</span>
            </>
          ) : saveStatus === "saved" ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-neutral-400">Saved</span>
            </>
          ) : (
            <span className={saveStatus === "error" ? "text-rose-400" : "text-amber-400"}>
              {saveStatus === "error" ? "Save failed" : "Unsaved"}
            </span>
          )}
        </div>

        {/* Compile button — only on LaTeX page */}
        {isLatexPage && (
          <Button
            variant="accent"
            size="sm"
            onClick={compileLatex}
            disabled={isCompiling}
            title={`Compile entry: ${files.find(file => file.id === (compileTargetId ?? entryFileId))?.path ?? "select a .tex entry file in the editor"}`}
            className="font-medium"
          >
            {isCompiling ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span className="truncate max-w-[220px]">{isCompiling ? "Compiling" : "Compile entry"}: {files.find(file => file.id === (compileTargetId ?? entryFileId))?.path ?? "not selected"}</span>
            <kbd className="hidden sm:inline-block ml-1 font-mono text-[9px] px-1 rounded bg-black/30">
              ⌘↵
            </kbd>
          </Button>
        )}

        {/* Export PDF */}
        <Link href={`${resumeBasePath}/preview`}>
          <Button variant="primary" size="sm">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </Link>

        {/* User avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400/20 to-sky-400/20 border border-white/10 flex items-center justify-center font-mono text-[11px] font-semibold text-white shrink-0">
          {resume.personal.fullName
            ?.split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("") || "ME"}
        </div>
      </div>
    </header>
  );
}

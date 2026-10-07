"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Code2,
  Sparkles,
  GitBranch,
  ArrowRight,
  Clock,
  CheckCircle,
  Download,
  Share2,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { Button } from "@/components/ui/button";

export function MasterResumeCard() {
  const { resume } = useResume();

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#121217] via-[#0E0E12] to-[#0A0A0C] p-6 shadow-2xl relative overflow-hidden select-none">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase bg-amber-400/15 text-amber-300 border border-amber-400/30">
              Master Source of Truth
            </span>
            <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" /> Updated 12 minutes ago
            </span>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">{resume.name}</h2>
          <p className="text-xs text-neutral-400 max-w-xl">
            {resume.personal.headline} · Targeting {resume.targetRole}
          </p>
        </div>

        {/* Primary actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href="/resume/demo/editor">
            <Button variant="primary" size="md">
              <FileText className="w-3.5 h-3.5" />
              <span>Open Structured Editor</span>
            </Button>
          </Link>

          <Link href="/resume/demo/latex">
            <Button variant="secondary" size="md">
              <Code2 className="w-3.5 h-3.5 text-sky-400" />
              <span>LaTeX IDE</span>
            </Button>
          </Link>

          <Link href="/resume/demo/preview">
            <Button variant="outline" size="md">
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Variant Branches */}
      <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            <GitBranch className="w-3.5 h-3.5 text-neutral-500" />
            <span>Targeted Role Variants (3 active)</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {resume.versions.map((ver) => (
              <Link
                key={ver.id}
                href="/resume/demo/editor"
                className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] hover:border-white/20 text-xs text-neutral-300 hover:text-white flex items-center gap-2 transition-all"
              >
                <span>{ver.versionName}</span>
                {ver.matchScore && (
                  <span className="font-mono text-[10px] text-amber-400 font-bold">
                    {ver.matchScore}% match
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href="/resume/new"
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors shrink-0"
        >
          <span>Branch new variant</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

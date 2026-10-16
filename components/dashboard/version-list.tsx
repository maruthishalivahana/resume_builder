"use client";

import React from "react";
import Link from "next/link";
import {
  GitBranch,
  ArrowRight,
  Sparkles,
  Calendar,
  Building,
  CheckCircle,
  Copy,
  ChevronRight,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";

export function VersionList() {
  const { resumeBasePath,  resume } = useResume();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-sky-400" />
          <h3 className="font-semibold text-white text-xs tracking-wide uppercase">
            Recent Versions & Deployments
          </h3>
        </div>
        <span className="text-[11px] text-neutral-500 font-mono">Git-backed history</span>
      </div>

      <div className="space-y-2">
        {resume.versions.map((ver, idx) => (
          <div
            key={ver.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-[#0E0E12] border border-white/[0.05] hover:border-white/15 transition-all gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-xs">{ver.versionName}</span>
                {ver.targetCompany && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-neutral-400">
                    {ver.targetCompany}
                  </span>
                )}
                {ver.matchScore && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-300 font-bold border border-amber-400/20">
                    {ver.matchScore}% Match
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500">
                {ver.changesSummary || "Committed to local workspace"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`${resumeBasePath}/editor`}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 hover:text-white transition-colors"
              >
                Open
              </Link>
              <Link
                href={`${resumeBasePath}/latex`}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                LaTeX
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

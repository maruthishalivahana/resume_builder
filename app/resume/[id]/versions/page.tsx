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
  Plus,
  Clock,
  ChevronRight,
  FileText,
} from "lucide-react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { useResume } from "@/hooks/use-resume";
import { Button } from "@/components/ui/button";

export default function VersionsPage() {
  const { resumeBasePath,  resume } = useResume();

  return (
    <WorkspaceShell>
      <div className="w-full flex-1 overflow-y-auto bg-[#070709] px-6 py-6 md:px-12 md:py-8 select-none text-xs">
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Resume Versions & Branches
              </h1>
              <p className="text-xs text-neutral-400">
                Track and manage tailored variants derived from your Master Engineering Resume.
              </p>
            </div>

            <Link href="/resume/new">
              <Button variant="primary" size="sm">
                <Plus className="w-3.5 h-3.5" />
                <span>Create Variant</span>
              </Button>
            </Link>
          </div>

          {/* Versions List */}
          <div className="space-y-3">
            {resume.versions.map((ver, idx) => (
              <div
                key={ver.id}
                className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] hover:border-white/20 p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-white text-sm">
                      {ver.versionName}
                    </span>
                    {idx === 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300 font-bold border border-amber-400/20">
                        Default
                      </span>
                    )}
                    {ver.targetCompany && (
                      <span className="text-[10px] px-2 py-0.2 rounded bg-white/5 border border-white/10 text-neutral-400 font-mono">
                        {ver.targetCompany}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {ver.changesSummary || "Committed to local workspace with verified metrics."}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-600" />
                      Created {new Date(ver.createdAt).toLocaleDateString()}
                    </span>
                    {ver.matchScore && (
                      <span className="text-amber-400 font-bold">
                        Alignment: {ver.matchScore}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`${resumeBasePath}/editor`}>
                    <Button variant="secondary" size="sm">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open Editor</span>
                    </Button>
                  </Link>

                  <Link href={`${resumeBasePath}/preview`}>
                    <Button variant="outline" size="sm">
                      <span>Preview PDF</span>
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

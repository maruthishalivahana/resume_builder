"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Code2,
  Eye,
  ShieldCheck,
  GitBranch,
  Briefcase,
  ArrowRight,
  Clock,
  Sparkles,
  Download,
  CheckCircle2,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { mockATSEvaluation, mockJobMatches } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export function ResumeOverview() {
  const { resumeBasePath,  resume, openAIAssistantForATS, openAIAssistantForJD } = useResume();

  return (
    <div className="w-full flex-1 overflow-y-auto bg-[#070709] px-6 py-6 md:px-12 md:py-8 select-none text-xs">
      <div className="max-w-[1240px] mx-auto space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Good evening, Maruthi.
            </h1>
            <p className="text-xs text-neutral-400">
              Your resume engineering environment is synchronized with the latest ATS standard.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href={`${resumeBasePath}/latex`}>
              <Button variant="outline" size="sm">
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                <span>LaTeX IDE</span>
              </Button>
            </Link>

            <Link href={`${resumeBasePath}/editor`}>
              <Button variant="primary" size="sm">
                <FileText className="w-3.5 h-3.5" />
                <span>Continue Editing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Master Resume Core Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#101015] via-[#0E0E12] to-[#08080A] p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                  Source of Truth
                </span>
                <span className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Updated 12 minutes ago
                </span>
              </div>

              <h2 className="text-xl font-bold text-white tracking-tight">
                {resume.name}
              </h2>
              <p className="text-xs text-neutral-400 max-w-xl leading-relaxed">
                {resume.personal.headline}
              </p>
            </div>

            {/* Twin Metrics: ATS Readiness & JD Alignment */}
            <div className="flex items-center gap-4 bg-black/40 border border-white/[0.06] rounded-xl p-3">
              <Link href={`${resumeBasePath}/ats`} className="text-center px-3 group">
                <div className="text-[10px] text-neutral-500 uppercase font-mono group-hover:text-neutral-300 transition-colors">
                  ATS Readiness
                </div>
                <div className="text-2xl font-bold font-mono text-white group-hover:text-emerald-400 transition-colors">
                  {mockATSEvaluation.readinessScore}
                </div>
                <div className="text-[10px] text-emerald-400 font-medium">Excellent</div>
              </Link>

              <div className="w-px h-8 bg-white/10" />

              <div
                onClick={openAIAssistantForJD}
                className="text-center px-3 cursor-pointer group"
              >
                <div className="text-[10px] text-neutral-500 uppercase font-mono group-hover:text-neutral-300 transition-colors">
                  JD Alignment
                </div>
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {mockATSEvaluation.jdKeywordAlignment}%
                </div>
                <div className="text-[10px] text-neutral-400">Target: Stripe</div>
              </div>
            </div>
          </div>

          {/* Quick Action Dock */}
          <div className="pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="text-neutral-500 font-mono text-[11px]">Active Template:</span>
              <span className="text-white font-medium">Modern Engineer (Jake&apos;s CV Single-Column)</span>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`${resumeBasePath}/preview`} className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>View PDF</span>
              </Link>
              <span className="text-neutral-700">·</span>
              <Link href={`${resumeBasePath}/ats`} className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Diagnostics (87)</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Dual Grid: Recent Versions & Job Targets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Versions */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-sky-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
                  Recent Versions
                </h3>
              </div>

              <Link
                href={`${resumeBasePath}/versions`}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                View all →
              </Link>
            </div>

            <div className="space-y-2">
              {resume.versions.map((ver) => (
                <Link
                  key={ver.id}
                  href={`${resumeBasePath}/editor`}
                  className="p-3 rounded-lg bg-[#0E0E12] border border-white/[0.05] hover:border-white/15 flex items-center justify-between transition-all block group"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-white group-hover:text-amber-300 transition-colors">
                      {ver.versionName}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      {ver.changesSummary || "Updated recently"}
                    </div>
                  </div>

                  {ver.matchScore && (
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {ver.matchScore}%
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Job Targets */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
                  Job Targets
                </h3>
              </div>

              <Link
                href={`${resumeBasePath}/jobs`}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                View targets →
              </Link>
            </div>

            <div className="space-y-2">
              {mockJobMatches.map((job) => (
                <div
                  key={job.id}
                  onClick={openAIAssistantForJD}
                  className="p-3 rounded-lg bg-[#0E0E12] border border-white/[0.05] hover:border-amber-400/30 flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-white group-hover:text-amber-300 transition-colors">
                      {job.title}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {job.company} · {job.location}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-white">
                      {job.matchScore}%
                    </div>
                    <div className="text-[9px] text-emerald-400 font-mono">
                      Strong Match
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

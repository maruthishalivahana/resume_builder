"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpRight,
  Sparkles,
  Link2,
  Building,
  MapPin,
  TrendingUp,
  AlertCircle,
  Copy,
  ChevronRight,
} from "lucide-react";
import { mockJobMatches } from "@/lib/mock-data";
import { JobRequirement } from "@/types/resume";
import { Button } from "@/components/ui/button";
import { useResume } from "@/hooks/use-resume";

export function JobMatcher() {
  const router = useRouter();
  const { setSelectedBulletId, setActiveSectionId } = useResume();
  const [selectedJob, setSelectedJob] = useState(mockJobMatches[0]);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "found" | "partial" | "missing">("all");
  const [activeReqId, setActiveReqId] = useState<string | null>(null);

  const filteredRequirements = selectedJob.requirements.filter((r) => {
    if (selectedFilter === "all") return true;
    return r.status === selectedFilter;
  });

  const handleTraceEvidence = (req: JobRequirement) => {
    if (req.matchedResumeTargetId) {
      setSelectedBulletId(req.matchedResumeTargetId);
      setActiveSectionId("sec_experience");
      router.push("/resume/demo/editor");
    }
  };

  const foundCount = selectedJob.requirements.filter((r) => r.status === "found").length;
  const partialCount = selectedJob.requirements.filter((r) => r.status === "partial").length;
  const missingCount = selectedJob.requirements.filter((r) => r.status === "missing").length;

  return (
    <div className="w-full h-[calc(100vh-3.25rem)] flex flex-col bg-[#070709] select-none text-xs">
      {/* Top Bar */}
      <div className="h-12 border-b border-white/[0.08] px-5 bg-[#0B0B0E] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white tracking-wide">
              JD Semantic Intelligence & Alignment
            </span>
          </div>

          <span className="text-neutral-700">|</span>

          <div className="flex items-center gap-2 text-neutral-400">
            <span className="font-medium text-neutral-200">{selectedJob.title}</span>
            <span className="text-neutral-600">@</span>
            <span className="text-neutral-300">{selectedJob.company}</span>
          </div>
        </div>

        {/* Target Switcher */}
        <div className="flex items-center gap-2">
          {mockJobMatches.map((j) => (
            <button
              key={j.id}
              onClick={() => setSelectedJob(j)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedJob.id === j.id
                  ? "bg-white/[0.08] text-white border border-white/10"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
              }`}
            >
              {j.company} ({j.matchScore}%)
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Pane Split: Left (Job Description) & Right (Traceable Analysis) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Raw Job Posting with Context */}
        <div className="w-1/2 border-r border-white/[0.08] bg-[#09090C] flex flex-col">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-white">{selectedJob.title}</h3>
              <div className="flex items-center gap-3 text-neutral-500 text-[11px]">
                <span className="flex items-center gap-1">
                  <Building className="w-3 h-3 text-neutral-600" /> {selectedJob.company}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-neutral-600" /> {selectedJob.location}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-400">
              Parsed from Stripe Careers
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-neutral-300 leading-relaxed font-sans select-text">
            <div className="rounded-lg bg-[#0E0E12] border border-white/[0.05] p-4 font-mono text-[11.5px] leading-6 whitespace-pre-wrap text-neutral-300">
              {selectedJob.rawText}
            </div>

            <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <Sparkles className="w-3.5 h-3.5" /> High-Priority Matching Recommendations
              </div>
              <ul className="space-y-1 text-neutral-300 text-[11px] list-disc list-inside">
                {selectedJob.gapsSummary.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Traceable Semantic Match Engine */}
        <div className="w-1/2 bg-[#070709] flex flex-col overflow-y-auto">
          {/* Match Score Banner */}
          <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-[#111116] via-[#0D0D11] to-[#070709] flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[11px] uppercase font-semibold text-neutral-500 tracking-wider">
                Overall Alignment Score
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-white tracking-tight">
                  {selectedJob.matchScore}%
                </span>
                <span className="text-xs text-emerald-400 font-medium">Strong Interview Fit</span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/30">
                <div className="text-emerald-400 font-bold">{foundCount}</div>
                <div className="text-[10px] text-neutral-500 uppercase">Found</div>
              </div>
              <div className="text-center px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/30">
                <div className="text-amber-400 font-bold">{partialCount}</div>
                <div className="text-[10px] text-neutral-500 uppercase">Partial</div>
              </div>
              <div className="text-center px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/30">
                <div className="text-rose-400 font-bold">{missingCount}</div>
                <div className="text-[10px] text-neutral-500 uppercase">Gap</div>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-5 py-3 border-b border-white/[0.04] bg-[#0A0A0D] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(["all", "found", "partial", "missing"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    selectedFilter === filter
                      ? "bg-white/[0.1] text-white border border-white/10"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-neutral-500">
              Click evidence to jump directly to resume bullet
            </span>
          </div>

          {/* Requirements Traceability Cards */}
          <div className="p-5 space-y-3">
            {filteredRequirements.map((req) => {
              const isFound = req.status === "found";
              const isPartial = req.status === "partial";
              const isMissing = req.status === "missing";

              return (
                <div
                  key={req.id}
                  onClick={() => setActiveReqId(req.id)}
                  className={`rounded-xl border p-4 transition-all duration-150 space-y-2.5 ${
                    activeReqId === req.id
                      ? "bg-[#111116] border-white/20 shadow-lg"
                      : "bg-[#0B0B0E] border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isFound && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {isPartial && <Clock className="w-4 h-4 text-amber-400" />}
                      {isMissing && <XCircle className="w-4 h-4 text-rose-400" />}
                      <span className="font-semibold text-white text-xs">{req.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-neutral-500">
                        {req.confidence}% conf
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isFound
                            ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40"
                            : isPartial
                            ? "bg-amber-950/50 text-amber-300 border border-amber-800/40"
                            : "bg-rose-950/50 text-rose-300 border border-rose-800/40"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  </div>

                  {/* Evidence Traceability */}
                  {req.evidenceSnippet ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTraceEvidence(req);
                      }}
                      className="group/ev flex items-start gap-2 p-2.5 rounded-lg bg-black/40 border border-white/[0.05] hover:border-amber-400/40 cursor-pointer transition-colors"
                      title="Click to jump to resume bullet"
                    >
                      <Link2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[10px] text-amber-400/80 font-mono flex items-center justify-between">
                          <span>GROUNDED EVIDENCE LINK</span>
                          <span className="opacity-0 group-hover/ev:opacity-100 flex items-center gap-0.5 text-white transition-opacity">
                            Jump to Resume <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                        <p className="text-neutral-300 text-[11px] leading-relaxed mt-0.5">
                          &ldquo;{req.evidenceSnippet}&rdquo;
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/30 text-rose-300 text-[11px]">
                      No direct evidence found in master resume. Consider adding relevant technical projects or coursework.
                    </div>
                  )}

                  {req.guidanceNote && (
                    <div className="text-[11px] text-neutral-400 flex items-start gap-1.5 pl-1">
                      <span className="text-neutral-500 font-semibold">Tip:</span>
                      <span>{req.guidanceNote}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

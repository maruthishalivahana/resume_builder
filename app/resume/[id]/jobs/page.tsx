"use client";

import React from "react";
import Link from "next/link";
import {
  Briefcase,
  ArrowRight,
  Sparkles,
  Building,
  MapPin,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { useResume } from "@/hooks/use-resume";
import { mockJobMatches } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export function JobTargetsPage() {
  const { openAIAssistantForJD } = useResume();

  return (
    <WorkspaceShell>
      <div className="w-full flex-1 overflow-y-auto bg-[#070709] px-6 py-6 md:px-12 md:py-8 select-none text-xs">
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Job Targets & Semantic Alignment
              </h1>
              <p className="text-xs text-neutral-400">
                Calibrated requirements, evidence traceability, and ATS keyword gaps per role.
              </p>
            </div>

            <Button variant="accent" size="sm" onClick={openAIAssistantForJD}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyze New JD</span>
            </Button>
          </div>

          {/* Job Targets List */}
          <div className="space-y-3">
            {mockJobMatches.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] hover:border-white/20 p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-white text-sm">
                      {job.title}
                    </span>
                    <span className="text-neutral-500 text-xs">·</span>
                    <span className="text-neutral-300 font-medium text-xs">
                      {job.company}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-neutral-600" /> {job.location}
                    </span>
                    <span>·</span>
                    <span>
                      {job.requirements.filter((r) => r.status === "found").length} of{" "}
                      {job.requirements.length} hard requirements verified
                    </span>
                  </div>

                  {/* Highlights pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {job.requirements.slice(0, 4).map((req) => (
                      <span
                        key={req.id}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          req.status === "found"
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/30"
                            : "bg-amber-950/40 text-amber-300 border-amber-800/30"
                        }`}
                      >
                        {req.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score & AI Trigger */}
                <div className="flex items-center gap-5 shrink-0 border-t md:border-t-0 md:border-l border-white/[0.06] pt-3 md:pt-0 md:pl-6">
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-amber-400">
                      {job.matchScore}%
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono">
                      Strong Match
                    </div>
                  </div>

                  <Button variant="secondary" size="sm" onClick={openAIAssistantForJD}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inspect in AI Copilot</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default JobTargetsPage;

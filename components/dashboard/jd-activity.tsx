"use client";

import React from "react";
import { Sparkles, ArrowRight, Briefcase } from "lucide-react";
import { mockJobMatches } from "@/lib/mock-data";
import { useResume } from "@/hooks/use-resume";

export function JDActivity() {
  const { openAIAssistantForJD } = useResume();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-xs tracking-wide uppercase">
            AI Assistant · JD Matching Telemetry
          </h3>
        </div>
        <button
          onClick={openAIAssistantForJD}
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
        >
          <span>Open in AI Assistant</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2.5">
        {mockJobMatches.map((job) => (
          <div
            key={job.id}
            onClick={openAIAssistantForJD}
            className="group block p-3 rounded-lg bg-[#0E0E12] border border-white/[0.05] hover:border-amber-400/30 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-xs group-hover:text-amber-300 transition-colors">
                    {job.title}
                  </span>
                  <span className="text-neutral-600 text-xs">·</span>
                  <span className="text-xs text-neutral-400">{job.company}</span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {job.requirements.filter((r) => r.status === "found").length} of{" "}
                  {job.requirements.length} hard requirements verified
                </div>
              </div>

              <div className="text-right">
                <div className="text-base font-bold font-mono text-white tracking-tight">
                  {job.matchScore}%
                </div>
                <div className="text-[10px] text-emerald-400 font-mono">Strong match</div>
              </div>
            </div>

            {/* Subtle Match Progress Bar */}
            <div className="mt-2.5 w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
                style={{ width: `${job.matchScore}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

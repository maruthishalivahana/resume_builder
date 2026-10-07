"use client";

import React from "react";
import { X, AlertTriangle, XCircle, CheckCircle2, Sparkles, Eye, ArrowRight, ShieldCheck } from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { mockATSEvaluation } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export function ATSIssueDrawer() {
  const { selectedATSIssueId, setSelectedATSIssueId, openAIAssistantForATS } = useResume();

  if (!selectedATSIssueId) return null;

  const issue = mockATSEvaluation.issues.find((i) => i.id === selectedATSIssueId);
  if (!issue) return null;

  const isCritical = issue.severity === "critical";
  const isWarning = issue.severity === "warning";

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] bg-[#0A0A0E] border-l border-white/[0.09] shadow-2xl flex flex-col text-xs select-none backdrop-blur-xl animate-in slide-in-from-right duration-150">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.07] px-4 bg-[#0E0E12] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white tracking-wide">Issue Diagnostics</span>
          <span
            className={`font-mono text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
              isCritical
                ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                : isWarning
                ? "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
            }`}
          >
            {issue.severity}
          </span>
        </div>

        <button
          onClick={() => setSelectedATSIssueId(null)}
          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Title */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-white leading-snug">
            {issue.problem}
          </h3>
          <div className="text-[10px] text-neutral-500 font-mono">
            Affected Section: Layout Engine & Parser Buffer
          </div>
        </div>

        {/* Why this matters */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0E0E14] p-4 space-y-2">
          <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider font-mono">
            Why this matters
          </div>
          <p className="text-neutral-300 text-xs leading-relaxed">
            {issue.explanation}
          </p>
        </div>

        {/* Recommended fix */}
        {issue.suggestedFix && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-2">
            <div className="text-[10px] uppercase font-semibold text-amber-400 tracking-wider font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Recommended fix</span>
            </div>
            <p className="text-white text-xs leading-relaxed">
              {issue.suggestedFix}
            </p>
          </div>
        )}

        {/* AI Action quote */}
        {issue.actionableAIRecommendation && (
          <div className="p-3.5 rounded-lg bg-[#14141C] border border-white/[0.08] space-y-1.5">
            <div className="text-[10px] text-neutral-500 font-mono uppercase">
              AI Proposal Preview
            </div>
            <p className="text-neutral-200 text-xs italic leading-relaxed">
              &ldquo;{issue.actionableAIRecommendation}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Drawer Actions */}
      <div className="p-4 border-t border-white/[0.08] bg-[#0E0E12] flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSelectedATSIssueId(null)}
        >
          <span>Dismiss</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setSelectedATSIssueId(null);
              openAIAssistantForATS();
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fix with AI</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

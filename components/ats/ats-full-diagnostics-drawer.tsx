"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { mockATSEvaluation } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export function ATSFullDiagnosticsDrawer() {
  const {
    isFullDiagnosticsOpen,
    setIsFullDiagnosticsOpen,
    setSelectedATSIssueId,
    openAIAssistantForATS,
  } = useResume();

  const [activeTab, setActiveTab] = useState<"all" | "critical" | "warning" | "good" | "keywords">("all");

  if (!isFullDiagnosticsOpen) return null;

  const filteredIssues = mockATSEvaluation.issues.filter((i) => {
    if (activeTab === "all") return true;
    return i.severity === activeTab;
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] bg-[#0A0A0D] border-l border-white/[0.09] shadow-2xl flex flex-col text-xs select-none backdrop-blur-xl animate-in slide-in-from-right duration-150">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.07] px-5 bg-[#0E0E12] flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white tracking-wide">
            Complete ATS Parser Diagnostics
          </h3>
          <p className="text-[10px] text-neutral-500 font-mono">
            7 checks evaluated · Standard parser registry
          </p>
        </div>

        <button
          onClick={() => setIsFullDiagnosticsOpen(false)}
          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 border-b border-white/[0.06] bg-[#0C0C10] flex items-center gap-1 overflow-x-auto text-[11px]">
        {(["all", "critical", "warning", "good", "keywords"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors capitalize whitespace-nowrap ${
              activeTab === tab
                ? "bg-white/10 text-white font-medium"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {activeTab === "keywords" ? (
          <div className="space-y-3">
            <div className="text-[11px] text-neutral-400 leading-relaxed">
              Deterministic skill detection in resume body without hallucinated additions.
            </div>

            <div className="space-y-2">
              {mockATSEvaluation.keywords.map((kw) => (
                <div
                  key={kw.name}
                  className="p-3 rounded-xl border border-white/[0.06] bg-[#0E0E14] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-xs">{kw.name}</span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        kw.status === "found"
                          ? "text-emerald-400"
                          : kw.status === "partial"
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {kw.status === "found" ? "✓ FOUND" : kw.status === "partial" ? "◐ PARTIAL" : "× MISSING"}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono">{kw.category}</div>
                  {kw.evidence ? (
                    <p className="text-[11px] text-neutral-300 leading-relaxed">{kw.evidence}</p>
                  ) : (
                    <p className="text-[11px] text-neutral-500 italic">Not found in resume body.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isCritical = issue.severity === "critical";
            const isWarning = issue.severity === "warning";
            const isGood = issue.severity === "good";

            return (
              <div
                key={issue.id}
                className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                  isCritical
                    ? "bg-rose-950/15 border-rose-800/30"
                    : isWarning
                    ? "bg-amber-950/15 border-amber-800/30"
                    : "bg-[#0E0E14] border-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isCritical && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    {isGood && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    <span className="font-semibold text-white text-xs">{issue.problem}</span>
                  </div>
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.2 rounded uppercase font-bold shrink-0 ${
                      isCritical
                        ? "bg-rose-950/50 text-rose-300 border border-rose-800/40"
                        : isWarning
                        ? "bg-amber-950/50 text-amber-300 border border-amber-800/40"
                        : "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40"
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>

                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  {issue.explanation}
                </p>

                {issue.suggestedFix && (
                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-medium">
                      Fix: {issue.suggestedFix}
                    </span>
                    <button
                      onClick={() => {
                        setIsFullDiagnosticsOpen(false);
                        setSelectedATSIssueId(issue.id);
                      }}
                      className="text-[10px] text-white underline hover:text-amber-300 ml-2 shrink-0"
                    >
                      Inspect →
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.08] bg-[#0E0E12] flex items-center justify-between">
        <span className="text-[10px] text-neutral-500 font-mono">
          Last analyzed 2 minutes ago
        </span>
        <Button
          variant="accent"
          size="sm"
          onClick={() => {
            setIsFullDiagnosticsOpen(false);
            openAIAssistantForATS();
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Fix All with AI</span>
        </Button>
      </div>
    </div>
  );
}

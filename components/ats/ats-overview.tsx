"use client";

import React, { useState } from "react";
import {
  RotateCw,
  Sparkles,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Layers,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { mockATSEvaluation } from "@/lib/mock-data";
import { useResume } from "@/hooks/use-resume";
import { Button } from "@/components/ui/button";
import { ATSIssueDrawer } from "@/components/ats/ats-issue-drawer";
import { ATSFullDiagnosticsDrawer } from "@/components/ats/ats-full-diagnostics-drawer";

export function ATSOverview() {
  const {
    resume,
    openAIAssistantForATS,
    setSelectedATSIssueId,
    setIsFullDiagnosticsOpen,
  } = useResume();

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeAgain = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1200);
  };

  // Extract only Top 3 issues (1 Critical + 2 Warnings)
  const topIssues = mockATSEvaluation.issues.slice(0, 3);

  const breakdownMetrics = [
    { title: "Parsing", score: mockATSEvaluation.breakdown.parsing, label: "Excellent" },
    { title: "Structure", score: mockATSEvaluation.breakdown.structure, label: "Excellent" },
    { title: "Keywords", score: mockATSEvaluation.breakdown.keywords, label: "Strong" },
    { title: "Formatting", score: mockATSEvaluation.breakdown.formatting, label: "Needs work" },
    { title: "Sections", score: mockATSEvaluation.breakdown.sections, label: "Excellent" },
    { title: "Readability", score: mockATSEvaluation.breakdown.readability, label: "Strong" },
  ];

  return (
    <div className="w-full flex-1 overflow-y-auto bg-[#070709] px-6 py-6 md:px-12 md:py-8 select-none text-xs">
      <div className="max-w-[1360px] mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                ATS Analysis
              </h1>
              <span className="text-neutral-600 text-sm">·</span>
              <span className="text-xs font-medium text-neutral-300">
                {resume.name}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
              <Clock className="w-3 h-3 text-neutral-600" />
              <span>Last analyzed: {isAnalyzing ? "Scanning document..." : mockATSEvaluation.lastAnalyzed}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyzeAgain}
              disabled={isAnalyzing}
              className="border-white/10 text-neutral-300 hover:text-white"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin text-amber-400" : ""}`} />
              <span>{isAnalyzing ? "Analyzing..." : "Analyze Again"}</span>
            </Button>

            <Button
              variant="accent"
              size="sm"
              onClick={openAIAssistantForATS}
              className="font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Fix with AI</span>
            </Button>
          </div>
        </div>

        {/* Level 1: Compact ATS Hero Score + Metrics */}
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#101015] via-[#0D0D11] to-[#08080A] p-6 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Score & Label */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-mono font-semibold text-neutral-400 tracking-wider">
                ATS READINESS
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl md:text-6xl font-bold font-mono text-white tracking-tight">
                  {mockATSEvaluation.readinessScore}
                </span>
                <div>
                  <span className="text-sm font-semibold text-emerald-400">
                    {mockATSEvaluation.readinessLabel}
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug max-w-sm mt-0.5">
                    Your resume is highly compatible with common applicant tracking systems.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Job Description Keyword Alignment (Distinguished as separate metric!) */}
            <div className="md:border-l md:border-white/[0.07] md:pl-8 space-y-1.5 shrink-0">
              <div className="text-[10px] uppercase font-mono font-semibold text-neutral-400 tracking-wider">
                JD KEYWORD ALIGNMENT
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-bold font-mono text-amber-400">
                  {mockATSEvaluation.jdKeywordAlignment}%
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  @ {mockATSEvaluation.targetCompany}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500">
                Target: {mockATSEvaluation.targetJobTitle}
              </div>
            </div>
          </div>

          {/* Horizontal Progress Visualization */}
          <div className="space-y-2 pt-1 border-t border-white/[0.05]">
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400 rounded-full"
                style={{ width: `${mockATSEvaluation.readinessScore}%` }}
              />
            </div>

            {/* Mini 4-pillar quick summary row */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono pt-1">
              <span>Parsing: <strong className="text-white">100</strong></span>
              <span>Structure: <strong className="text-white">94</strong></span>
              <span>Keywords: <strong className="text-white">91</strong></span>
              <span>Formatting: <strong className="text-amber-400">78</strong></span>
            </div>
          </div>
        </div>

        {/* Level 2: Top 3 Issues Only (Compact Rows) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs uppercase font-mono font-semibold text-neutral-300 tracking-wider">
                Top Priority Issues
              </h3>
              <p className="text-[11px] text-neutral-500">
                Fix these high-impact items first to maximize parser success.
              </p>
            </div>

            <button
              onClick={() => setIsFullDiagnosticsOpen(true)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View all 7 issues</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {topIssues.map((issue, idx) => {
              const isCritical = issue.severity === "critical";

              return (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                    isCritical
                      ? "bg-[#120B0D] border-rose-800/30 hover:border-rose-700/50"
                      : "bg-[#110F0A] border-amber-800/25 hover:border-amber-700/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                          isCritical
                            ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                            : "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                        }`}
                      >
                        {idx + 1}. {issue.severity}
                      </span>
                    </div>

                    <h4 className="font-semibold text-white text-xs leading-snug line-clamp-2">
                      {issue.problem}
                    </h4>

                    {issue.suggestedFix && (
                      <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">
                        {issue.suggestedFix}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-white/[0.05] flex items-center justify-end">
                    <button
                      onClick={() => setSelectedATSIssueId(issue.id)}
                      className="text-xs text-neutral-300 hover:text-white flex items-center gap-1 transition-colors font-medium cursor-pointer"
                    >
                      <span>View issue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Level 3: Compact 2×3 ATS Breakdown Grid */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-mono font-semibold text-neutral-300 tracking-wider">
              Diagnostic Breakdown (6 Pillars)
            </h3>
            <button
              onClick={() => setIsFullDiagnosticsOpen(true)}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 font-mono transition-colors"
            >
              Inspect parser signals
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {breakdownMetrics.map((item) => (
              <div
                key={item.title}
                onClick={() => setIsFullDiagnosticsOpen(true)}
                className="rounded-xl border border-white/[0.07] bg-[#0A0A0E] hover:border-white/20 p-3.5 space-y-2 cursor-pointer transition-all hover:bg-[#0E0E14]"
              >
                <div className="flex items-center justify-between text-neutral-400 text-xs">
                  <span className="font-medium text-neutral-300">{item.title}</span>
                </div>

                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-xl font-bold text-white">{item.score}</span>
                  <span
                    className={`text-[10px] ${
                      item.score >= 90
                        ? "text-emerald-400"
                        : item.score >= 80
                        ? "text-sky-400"
                        : "text-amber-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>

                <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.score >= 90
                        ? "bg-emerald-400"
                        : item.score >= 80
                        ? "bg-sky-400"
                        : "bg-amber-400"
                    }`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slide-over Drawers for Details */}
      <ATSIssueDrawer />
      <ATSFullDiagnosticsDrawer />
    </div>
  );
}

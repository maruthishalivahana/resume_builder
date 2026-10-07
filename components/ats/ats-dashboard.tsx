"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  RotateCw,
  Sparkles,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  FileText,
  Clock,
  Briefcase,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Check,
  ChevronDown,
} from "lucide-react";
import { mockATSEvaluation } from "@/lib/mock-data";
import { useResume } from "@/hooks/use-resume";
import { Button } from "@/components/ui/button";

export function ATSDashboard() {
  const { resume, openAIAssistantForATS } = useResume();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "warning" | "good">("all");

  const handleAnalyzeAgain = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1200);
  };

  const filteredIssues = mockATSEvaluation.issues.filter((issue) => {
    if (activeFilter === "all") return true;
    return issue.severity === activeFilter;
  });

  const criticalCount = mockATSEvaluation.issues.filter((i) => i.severity === "critical").length;
  const warningCount = mockATSEvaluation.issues.filter((i) => i.severity === "warning").length;
  const goodCount = mockATSEvaluation.issues.filter((i) => i.severity === "good").length;

  return (
    <div className="w-full flex-1 overflow-y-auto bg-[#070709] p-6 md:p-10 select-none text-xs">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Workspace Breadcrumbs & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
              <span>Diagnostics</span>
              <span>/</span>
              <span className="text-neutral-300">Parser Evaluation</span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                ATS Analysis
              </h1>
              <span className="text-neutral-600 text-sm">·</span>
              <span className="text-sm font-medium text-neutral-300">
                {resume.name}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
              <Clock className="w-3 h-3 text-neutral-600" />
              <span>Last analyzed: {isAnalyzing ? "Scanning..." : mockATSEvaluation.lastAnalyzed}</span>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyzeAgain}
              disabled={isAnalyzing}
              className="text-neutral-300 border-white/10 hover:border-white/20"
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
              <span>Fix Issues with AI</span>
            </Button>
          </div>
        </div>

        {/* ATS Score & Metric Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Large Score Section (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#111116] via-[#0E0E12] to-[#08080B] p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono font-semibold text-neutral-400 tracking-wider">
                  Diagnostic Evaluation
                </span>
                <h3 className="text-base font-semibold text-white">
                  ATS Readability & Parser Health
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {mockATSEvaluation.readinessLabel}
              </span>
            </div>

            {/* Score Visualization: Large, Elegant & Non-Gamified */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-8 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-6xl sm:text-7xl font-bold font-mono text-white tracking-tighter">
                  {mockATSEvaluation.readinessScore}
                </span>
                <div className="space-y-0.5">
                  <div className="text-xs font-mono font-semibold uppercase text-neutral-400 tracking-wider">
                    ATS READINESS
                  </div>
                  <div className="text-xs text-emerald-400 font-medium">
                    {mockATSEvaluation.readinessLabel} Compatibility
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                  <span>Parser Integrity</span>
                  <span>{mockATSEvaluation.readinessScore} / 100</span>
                </div>
                <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-sky-400 to-emerald-400 rounded-full"
                    style={{ width: `${mockATSEvaluation.readinessScore}%` }}
                  />
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Evaluated across standard Workday, Greenhouse, Lever, and Taleo parsing patterns.
                </p>
              </div>
            </div>

            {/* Secondary metric: Clearly distinguish ATS Readiness from JD Keyword Alignment */}
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-neutral-400">
                <Briefcase className="w-3.5 h-3.5 text-sky-400" />
                <span>Job Description Keyword Alignment:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white font-bold text-sm">
                  {mockATSEvaluation.jdKeywordAlignment}%
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  (Target: {mockATSEvaluation.targetCompany})
                </span>
              </div>
            </div>
          </div>

          {/* Categorized Breakdown Bars (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#0A0A0E] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
                ATS Breakdown
              </h3>
              <span className="text-[10px] text-neutral-500 font-mono">6 Pillars</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {[
                { name: "Parsing", score: mockATSEvaluation.breakdown.parsing },
                { name: "Keywords", score: mockATSEvaluation.breakdown.keywords },
                { name: "Structure", score: mockATSEvaluation.breakdown.structure },
                { name: "Formatting", score: mockATSEvaluation.breakdown.formatting },
                { name: "Sections", score: mockATSEvaluation.breakdown.sections },
                { name: "Readability", score: mockATSEvaluation.breakdown.readability },
              ].map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-300 font-sans">{item.name}</span>
                    <span className="text-white font-bold">{item.score}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.score >= 90
                          ? "bg-emerald-400"
                          : item.score >= 80
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Structured ATS Issues Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-white">Diagnostic Issues & Checks</h3>
              <p className="text-[11px] text-neutral-500">
                Prioritized evaluation of layout, typography glyphs, and heading recognition.
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/[0.05]">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeFilter === "all" ? "bg-white/10 text-white font-medium" : "text-neutral-500"
                }`}
              >
                All ({mockATSEvaluation.issues.length})
              </button>
              <button
                onClick={() => setActiveFilter("critical")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeFilter === "critical"
                    ? "bg-rose-500/20 text-rose-300 font-medium"
                    : "text-neutral-500"
                }`}
              >
                Critical ({criticalCount})
              </button>
              <button
                onClick={() => setActiveFilter("warning")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeFilter === "warning"
                    ? "bg-amber-500/20 text-amber-300 font-medium"
                    : "text-neutral-500"
                }`}
              >
                Warning ({warningCount})
              </button>
              <button
                onClick={() => setActiveFilter("good")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeFilter === "good"
                    ? "bg-emerald-500/20 text-emerald-300 font-medium"
                    : "text-neutral-500"
                }`}
              >
                Good ({goodCount})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredIssues.map((issue) => {
              const isCritical = issue.severity === "critical";
              const isWarning = issue.severity === "warning";
              const isGood = issue.severity === "good";

              return (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-4 space-y-2 transition-all ${
                    isCritical
                      ? "bg-rose-950/15 border-rose-800/30"
                      : isWarning
                      ? "bg-amber-950/15 border-amber-800/30"
                      : "bg-[#0A0A0E] border-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isCritical && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                      {isGood && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      <span className="font-semibold text-white text-xs">{issue.problem}</span>
                    </div>

                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
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

                  <p className="text-neutral-400 text-[11px] leading-relaxed pl-6">
                    {issue.explanation}
                  </p>

                  {issue.suggestedFix && (
                    <div className="ml-6 p-2.5 rounded-lg bg-black/40 border border-white/[0.05] text-[11px] flex items-center justify-between gap-2">
                      <div className="text-neutral-300">
                        <span className="font-semibold text-amber-400">Suggested Fix: </span>
                        {issue.suggestedFix}
                      </div>

                      <button
                        onClick={openAIAssistantForATS}
                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium font-mono shrink-0 transition-colors"
                      >
                        <span>Fix with AI</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ATS Keyword Analysis Section (Separated from JD matching) */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-white">Keyword Coverage</h3>
              <p className="text-[11px] text-neutral-500">
                Deterministic detection of technical skills in resume. No fabricated recommendations.
              </p>
            </div>
            <span className="text-[10px] font-mono text-neutral-500 uppercase">
              Zero Hallucination Filter Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {mockATSEvaluation.keywords.map((kw) => (
              <div
                key={kw.name}
                className="p-3 rounded-lg bg-[#0E0E12] border border-white/[0.05] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white text-xs">{kw.name}</span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      kw.status === "found"
                        ? "text-emerald-400"
                        : kw.status === "partial"
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {kw.status === "found" ? "✓" : kw.status === "partial" ? "◐" : "×"}
                  </span>
                </div>

                <div className="text-[10px] text-neutral-500 font-mono">{kw.category}</div>

                {kw.evidence ? (
                  <p className="text-[11px] text-neutral-400 leading-snug">{kw.evidence}</p>
                ) : (
                  <p className="text-[11px] text-neutral-500 italic">
                    Not found in resume.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

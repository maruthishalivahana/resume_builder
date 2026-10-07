"use client";

import React, { useState } from "react";
import {
  Sparkles,
  X,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Sliders,
  Check,
  RefreshCw,
  Copy,
  ChevronRight,
  FileText,
  Clock,
  Layers,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { mockJobMatches, mockATSEvaluation } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export function AIAssistantDrawer() {
  const {
    isAIAssistantOpen,
    setIsAIAssistantOpen,
    aiAssistantView,
    setAiAssistantView,
    activeSuggestion,
    acceptAISuggestion,
    rejectAISuggestion,
    resume,
  } = useResume();

  const [currentATSIssueIdx, setCurrentATSIssueIdx] = useState(0);
  const [fixedIssues, setFixedIssues] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState(mockJobMatches[0]);

  if (!isAIAssistantOpen) return null;

  const atsFixableIssues = mockATSEvaluation.issues.filter(
    (i) => i.severity === "critical" || i.severity === "warning"
  );
  const currentIssue = atsFixableIssues[currentATSIssueIdx];

  const handleApplyATSFix = (issueId: string) => {
    setFixedIssues((prev) => [...prev, issueId]);
    if (currentATSIssueIdx < atsFixableIssues.length - 1) {
      setCurrentATSIssueIdx((prev) => prev + 1);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0A0A0E] border-l border-white/[0.09] shadow-2xl flex flex-col text-xs select-none backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Top Drawer Header */}
      <div className="h-13 border-b border-white/[0.08] px-4 bg-[#0F0F14] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-white tracking-wide flex items-center gap-1.5">
              <span>AI Assistant</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/5 border border-white/10 text-neutral-400">
                Grounded
              </span>
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              Contextual Intelligence Layer
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAIAssistantOpen(false)}
          className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Close AI Assistant (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Capability Navigation Tabs inside AI Assistant */}
      <div className="border-b border-white/[0.06] px-4 py-2 bg-[#0C0C10] flex items-center gap-1">
        <button
          onClick={() => setAiAssistantView("ats_fixes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            aiAssistantView === "ats_fixes"
              ? "bg-white/[0.1] text-white border border-white/10 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>ATS Fixes</span>
          {atsFixableIssues.length > 0 && (
            <span className="text-[9px] px-1 rounded-full bg-amber-400/20 text-amber-300 font-bold">
              {atsFixableIssues.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAiAssistantView("jd_match")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            aiAssistantView === "jd_match"
              ? "bg-white/[0.1] text-white border border-white/10 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 text-sky-400" />
          <span>JD Matching</span>
          <span className="text-[9px] px-1 rounded-full bg-sky-400/20 text-sky-300 font-bold">
            92%
          </span>
        </button>

        <button
          onClick={() => setAiAssistantView("contextual")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
            aiAssistantView === "contextual"
              ? "bg-white/[0.1] text-white border border-white/10 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Bullet Polish</span>
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* CAPABILITY 1: ATS Issue-by-Issue Remediation */}
        {aiAssistantView === "ats_fixes" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-neutral-300 leading-relaxed">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ATS Remediation Assistant</span>
              </div>
              <p className="text-[11.5px] text-neutral-400">
                I found {atsFixableIssues.length} ATS-related issues in your resume.
                I can help you resolve them one at a time with verified formatting standards.
              </p>
            </div>

            {currentIssue ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#0E0E14] p-4 space-y-3.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span className="font-mono uppercase font-semibold text-amber-400">
                    Issue {currentATSIssueIdx + 1} of {atsFixableIssues.length}
                  </span>
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      currentIssue.severity === "critical"
                        ? "bg-rose-950/60 text-rose-300 border border-rose-800/40"
                        : "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                    }`}
                  >
                    {currentIssue.severity}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-white text-xs">
                    {currentIssue.problem}
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {currentIssue.explanation}
                  </p>
                </div>

                {/* AI Recommendation Quote */}
                <div className="p-3 rounded-lg bg-[#14141C] border border-amber-400/30 space-y-2">
                  <div className="text-[10px] uppercase font-semibold text-amber-400 font-mono">
                    AI Diagnostic Proposal
                  </div>
                  <p className="text-white text-xs leading-relaxed italic">
                    &ldquo;{currentIssue.actionableAIRecommendation}&rdquo;
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (currentATSIssueIdx < atsFixableIssues.length - 1) {
                        setCurrentATSIssueIdx((prev) => prev + 1);
                      }
                    }}
                    className="text-neutral-400"
                  >
                    Skip
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApplyATSFix(currentIssue.id)}
                      disabled={fixedIssues.includes(currentIssue.id)}
                    >
                      {fixedIssues.includes(currentIssue.id) ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Applied</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply Recommendation</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="font-semibold text-white">All ATS Issues Resolved</h4>
                <p className="text-neutral-400 text-xs">
                  Your resume formatting and section structure meet 100% of standard parser requirements.
                </p>
              </div>
            )}
          </div>
        )}

        {/* CAPABILITY 2: Job Description Matching & Alignment */}
        {aiAssistantView === "jd_match" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[#111116] border border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-xs">{selectedJob.title}</div>
                <div className="text-[11px] text-neutral-500">
                  {selectedJob.company} · {selectedJob.location}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold text-amber-400">
                  {selectedJob.matchScore}%
                </div>
                <div className="text-[9px] text-neutral-500 font-mono uppercase">Match</div>
              </div>
            </div>

            <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
              Grounded Requirement Traceability
            </div>

            <div className="space-y-2">
              {selectedJob.requirements.map((req) => (
                <div
                  key={req.id}
                  className="p-3 rounded-lg bg-[#0E0E12] border border-white/[0.05] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-xs">{req.name}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                        req.status === "found"
                          ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/40"
                          : req.status === "partial"
                          ? "bg-amber-950/50 text-amber-300 border border-amber-800/40"
                          : "bg-rose-950/50 text-rose-300 border border-rose-800/40"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {req.evidenceSnippet ? (
                    <div className="p-2 rounded bg-black/40 border border-white/[0.04] text-[11px] text-neutral-400">
                      <span className="text-[10px] text-amber-400/90 font-mono block mb-0.5">
                        EVIDENCE:
                      </span>
                      &ldquo;{req.evidenceSnippet}&rdquo;
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-300/80">
                      Not found in resume. Consider highlighting relevant project work.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CAPABILITY 3: Contextual Bullet & Tailoring Polish */}
        {aiAssistantView === "contextual" && (
          <div className="space-y-4">
            {activeSuggestion ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#0E0E12] border border-white/[0.06] p-3 space-y-2">
                  <div className="text-[10px] uppercase font-semibold text-neutral-500 font-mono">
                    Target Original Bullet
                  </div>
                  <p className="text-neutral-400 leading-relaxed pl-2 border-l-2 border-rose-500/40 line-through">
                    {activeSuggestion.originalText}
                  </p>
                </div>

                <div className="rounded-lg bg-[#14141C] border border-amber-400/40 p-3 space-y-2">
                  <div className="text-[10px] uppercase font-semibold text-amber-400 font-mono">
                    Enhanced Recommendation
                  </div>
                  <p className="text-white font-medium leading-relaxed pl-2 border-l-2 border-amber-400">
                    {activeSuggestion.suggestedText}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#0E0E12] border border-white/[0.05] space-y-1.5">
                  <div className="text-[10px] uppercase font-semibold text-neutral-500 font-mono">
                    Grounding Rationale
                  </div>
                  <p className="text-neutral-300 text-[11px] leading-relaxed">
                    {activeSuggestion.rationale}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectAISuggestion(activeSuggestion.id)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => acceptAISuggestion(activeSuggestion.id)}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept Diff</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <h4 className="font-semibold text-white text-xs">Contextual Bullet Assistant</h4>
                <p className="text-neutral-400 text-xs max-w-xs mx-auto leading-relaxed">
                  Hover any bullet in the Structured Editor and click <strong>AI Polish</strong>,
                  or select an ATS recommendation to inspect diffs here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0A0A0E] flex items-center justify-between text-[10px] text-neutral-500 font-mono">
        <span>Deterministic Verification Layer</span>
        <span>Zero Hallucinations</span>
      </div>
    </div>
  );
}

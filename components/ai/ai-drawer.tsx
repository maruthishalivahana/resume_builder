"use client";

import React, { useState } from "react";
import {
  Sparkles,
  X,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  CornerDownLeft,
  ChevronRight,
  ShieldCheck,
  Sliders,
  Send,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { mockJobMatches, mockATSEvaluation } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export function AIDrawer() {
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

  const [inputQuery, setInputQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"copilot" | "jd" | "ats">("copilot");

  if (!isAIAssistantOpen) return null;

  const atsIssues = mockATSEvaluation.issues.filter(
    (i) => i.severity === "critical" || i.severity === "warning"
  );

  const quickPrompts = [
    { label: "Analyze this JD", action: () => setActiveTab("jd") },
    { label: "Find resume gaps", action: () => setActiveTab("jd") },
    { label: "Improve selected bullet", action: () => setActiveTab("copilot") },
    { label: "Fix ATS issues", action: () => setActiveTab("ats") },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[390px] bg-[#0A0A0D] border-l border-white/[0.09] shadow-2xl flex flex-col text-xs select-none backdrop-blur-xl animate-in slide-in-from-right duration-150">
      {/* Top Header */}
      <div className="h-14 border-b border-white/[0.07] px-4 bg-[#0E0E12] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-semibold text-white tracking-wide flex items-center gap-1.5">
              <span>✦ Resume AI</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                Copilot
              </span>
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              Context: {resume.name}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsAIAssistantOpen(false)}
          className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Close AI Copilot (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sub Navigation */}
      <div className="px-3 py-2 border-b border-white/[0.06] bg-[#0C0C10] flex items-center gap-1 text-[11px]">
        <button
          onClick={() => setActiveTab("copilot")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activeTab === "copilot"
              ? "bg-white/10 text-white font-medium"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Bullet Copilot
        </button>
        <button
          onClick={() => setActiveTab("jd")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activeTab === "jd"
              ? "bg-white/10 text-white font-medium"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          JD Alignment
        </button>
        <button
          onClick={() => setActiveTab("ats")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            activeTab === "ats"
              ? "bg-white/10 text-white font-medium"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          ATS Fixes ({atsIssues.length})
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "copilot" && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">
                How can I help?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={qp.action}
                    className="px-2.5 py-1 rounded-md bg-[#14141A] border border-white/10 hover:border-white/20 text-neutral-300 hover:text-white text-[11px] transition-colors"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Suggestion Diff Card */}
            {activeSuggestion ? (
              <div className="rounded-xl border border-amber-400/30 bg-[#111116] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Enhanced Bullet
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    High Confidence
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="pl-2 border-l-2 border-rose-500/40 text-neutral-400 line-through leading-relaxed">
                    {activeSuggestion.originalText}
                  </div>
                  <div className="pl-2 border-l-2 border-amber-400 text-white font-medium leading-relaxed">
                    {activeSuggestion.suggestedText}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.04] text-[11px] text-neutral-400 space-y-1">
                  <span className="text-neutral-300 font-medium">Why: </span>
                  {activeSuggestion.rationale}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
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
                    <span>Apply Diff</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-white/[0.06] bg-[#0E0E12] text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                  <FileText className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white text-xs">No active bullet selected</h4>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Hover any bullet in the Editor and click <strong>AI Polish</strong> to generate
                  calibrated metric enhancements.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "jd" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-[#111116] border border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-xs">
                  {mockJobMatches[0].title}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {mockJobMatches[0].company}
                </div>
              </div>
              <div className="font-mono text-base font-bold text-amber-400">
                {mockJobMatches[0].matchScore}%
              </div>
            </div>

            <div className="space-y-2">
              {mockJobMatches[0].requirements.slice(0, 4).map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 rounded-lg bg-[#0E0E12] border border-white/[0.05] space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{req.name}</span>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                        req.status === "found"
                          ? "bg-emerald-950/50 text-emerald-400"
                          : req.status === "partial"
                          ? "bg-amber-950/50 text-amber-300"
                          : "bg-rose-950/50 text-rose-300"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  {req.evidenceSnippet && (
                    <p className="text-[10px] text-neutral-400 italic truncate">
                      &ldquo;{req.evidenceSnippet}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ats" && (
          <div className="space-y-3">
            <div className="text-neutral-400 text-xs leading-relaxed">
              I can help you resolve detected parser issues one at a time.
            </div>

            {atsIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3 rounded-xl border border-white/[0.08] bg-[#0E0E14] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{issue.problem}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold bg-amber-400/10 text-amber-300">
                    {issue.severity}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {issue.explanation}
                </p>
                <div className="pt-1 flex justify-end">
                  <Button variant="accent" size="sm">
                    <span>Apply Fix</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input prompt field at bottom */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0E0E12]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141418] border border-white/10 focus-within:border-amber-400/50 transition-colors">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Copilot anything..."
            className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
          <button
            className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
            title="Send"
          >
            <Send className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

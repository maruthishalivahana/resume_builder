"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Edit3,
  Paperclip,
  Sparkles,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  RotateCcw,
  FilePlus,
  Briefcase,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { TailoringSuggestionView } from "@/lib/api/tailoring";

function ResumeAIIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Sparkles className="h-[0.85em] w-[0.85em]" strokeWidth={1.8} />
      <span className="absolute bottom-[0.08em] right-0 h-[0.28em] w-[0.28em] rounded-full bg-current" />
    </span>
  );
}

function StatusBadge({ status }: { status: TailoringSuggestionView["status"] }) {
  if (status === "accepted" || status === "edited") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" /> Applied
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2 py-0.5 text-[10px] font-medium text-neutral-400 border border-neutral-500/20">
        <XCircle className="h-3 w-3 text-neutral-500" /> Rejected
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400 border border-rose-500/20">
        <AlertTriangle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20">
      <Clock className="h-3 w-3 text-amber-400" /> Pending Review
    </span>
  );
}

export function ResumeAIFloating() {
  const {
    isAIAssistantOpen,
    setIsAIAssistantOpen,
    activeJdSession,
    startNewJdAnalysis,
    generateTailoringSuggestions,
    acceptTailoringSuggestionById,
    rejectTailoringSuggestionById,
    chatMessages,
    isChatLoading,
    chatError,
    sendChatMessage,
    startNewChat,
    clearChatMessages,
  } = useResume();

  const [mode, setMode] = useState<"chat" | "jd">("chat");
  const [chatInput, setChatInput] = useState("");
  const [jdInput, setJdInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<{
    id: string;
    action: "accept" | "reject";
  } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [jdExpanded, setJdExpanded] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const jdScrollRef = useRef<HTMLDivElement>(null);

  const visibleSuggestions = useMemo(() => {
    return activeJdSession?.suggestions ?? [];
  }, [activeJdSession]);

  const pendingCount = useMemo(
    () => visibleSuggestions.filter((s) => s.status === "pending").length,
    [visibleSuggestions]
  );

  // Auto-expand first pending suggestion
  useEffect(() => {
    if (!userInteracted && visibleSuggestions.length > 0) {
      const firstPending = visibleSuggestions.find((s) => s.status === "pending");
      if (firstPending) {
        setExpandedId(firstPending.suggestionId);
      } else if (!expandedId && visibleSuggestions[0]) {
        setExpandedId(visibleSuggestions[0].suggestionId);
      }
    }
  }, [visibleSuggestions, userInteracted, expandedId]);

  // Adjust textarea height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [chatInput, jdInput, mode]);

  // Auto-scroll chat transcript to newest message
  useEffect(() => {
    if (mode === "chat") {
      chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatLoading, mode]);

  // Auto-scroll JD panel on new progress / completion
  useEffect(() => {
    if (mode === "jd") {
      jdScrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeJdSession?.status, activeJdSession?.suggestions?.length, mode]);

  // Reset inputs and errors when drawer is closed
  useEffect(() => {
    if (!isAIAssistantOpen) {
      setConfirmClearChat(false);
      setRequestError(null);
    }
  }, [isAIAssistantOpen]);

  const toggleExpand = (id: string) => {
    setUserInteracted(true);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const isJdAnalyzing =
    activeJdSession?.status === "indexing" ||
    activeJdSession?.status === "extracting" ||
    activeJdSession?.status === "analyzing";

  const submitRequest = async () => {
    if (actionInProgress) return;

    if (mode === "chat") {
      const text = chatInput.trim();
      if (!text || isChatLoading) return;
      setRequestError(null);
      setChatInput("");
      setConfirmClearChat(false);
      await sendChatMessage(text);
    } else {
      const text = jdInput.trim();
      if (!text || isJdAnalyzing) return;
      setRequestError(null);
      setJdInput("");
      setUserInteracted(false);
      setJdExpanded(false);
      try {
        await generateTailoringSuggestions(text);
      } catch (error) {
        setRequestError(
          error instanceof Error ? error.message : "Unable to generate grounded suggestions."
        );
      }
    }
  };

  const handleDecision = async (suggestionId: string, action: "accept" | "reject") => {
    if (actionInProgress) return;
    setActionInProgress({ id: suggestionId, action });
    setRequestError(null);
    try {
      if (action === "accept") {
        await acceptTailoringSuggestionById(suggestionId);
      } else {
        await rejectTailoringSuggestionById(suggestionId);
      }
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : `Unable to ${action} suggestion.`
      );
    } finally {
      setActionInProgress(null);
    }
  };

  const handleNewJdAnalysis = () => {
    startNewJdAnalysis();
    setJdInput("");
    setRequestError(null);
    setJdExpanded(false);
  };

  if (!isAIAssistantOpen) {
    return (
      <button
        type="button"
        aria-label="Open RESUME AI"
        title="Chat with RESUME AI · Ctrl+J"
        onClick={() => setIsAIAssistantOpen(true)}
        className="fixed bottom-5 right-5 z-[65] flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.14] bg-[#111216] text-neutral-300 shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-0.5 hover:border-white/[0.25] hover:bg-[#191a1f] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        <ResumeAIIcon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <section
      aria-label="RESUME AI assistant"
      className="fixed bottom-4 right-4 z-[70] flex h-[min(740px,calc(100vh-32px))] w-[min(480px,calc(100vw-32px))] flex-col overflow-hidden rounded-[18px] border border-white/[0.1] bg-[#101114] text-neutral-200 shadow-[0_24px_70px_rgba(0,0,0,0.52)]"
    >
      {/* Top Header */}
      <header className="flex h-[53px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <ResumeAIIcon className="h-4 w-4 text-neutral-200" />
            <span className="text-[12px] font-semibold tracking-[0.11em] text-neutral-100">
              RESUME AI
            </span>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-0.5 rounded-lg bg-[#18191e] p-0.5 text-[10.5px]">
            <button
              type="button"
              onClick={() => {
                setMode("chat");
                setRequestError(null);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                mode === "chat"
                  ? "bg-white/10 text-white font-medium shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("jd");
                setRequestError(null);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                mode === "jd"
                  ? "bg-white/10 text-white font-medium shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              JD Tailor
            </button>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5">
          {mode === "chat" ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Start a new chat conversation"
                onClick={() => {
                  setConfirmClearChat(false);
                  startNewChat();
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>New Chat</span>
              </button>
              <button
                type="button"
                title="Clear chat history"
                onClick={() => setConfirmClearChat((prev) => !prev)}
                className="rounded-md p-1.5 text-neutral-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Start a new job description analysis"
              onClick={handleNewJdAnalysis}
              className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[10.5px] font-medium text-neutral-300 hover:bg-white/[0.1] hover:text-white transition-colors"
            >
              <FilePlus className="h-3 w-3 text-amber-400" />
              <span>New Analysis</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Close RESUME AI"
            onClick={() => setIsAIAssistantOpen(false)}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {mode === "chat" ? (
          /* ==========================================================
           * CHAT MODE VIEW
           * ========================================================== */
          <div className="space-y-3">
            <div className="text-[11px] text-neutral-400">
              Ask questions about resume formatting, ATS best practices, or career strategy.
            </div>

            {/* Clear Chat Confirmation Banner */}
            {confirmClearChat && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-[11px] text-rose-200 flex items-center justify-between animate-in fade-in">
                <span>Permanently clear chat transcript?</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmClearChat(false)}
                    className="rounded px-2.5 py-1 text-[10.5px] text-neutral-400 hover:text-neutral-200 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearChatMessages();
                      setConfirmClearChat(false);
                    }}
                    className="rounded bg-rose-600 px-2.5 py-1 text-[10.5px] font-medium text-white hover:bg-rose-500"
                  >
                    Clear History
                  </button>
                </div>
              </div>
            )}

            {/* Chat Messages Transcript */}
            {chatMessages.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <ResumeAIIcon className="mb-3 h-8 w-8 text-neutral-500" />
                <h3 className="text-xs font-medium text-neutral-300">Clean Chat Session</h3>
                <p className="mt-1 text-[11px] text-neutral-500 max-w-[240px]">
                  Ask a question below to start a new conversation.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-[11.5px] leading-relaxed whitespace-pre-wrap break-words ${
                      msg.role === "user"
                        ? "bg-amber-400/15 text-amber-100 border border-amber-400/30 rounded-tr-none"
                        : "bg-[#14151a] text-neutral-200 border border-white/[0.08] rounded-tl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.timestamp && (
                    <span className="mt-1 text-[9px] text-neutral-500 px-1 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              ))
            )}

            {/* In-progress indicator */}
            {isChatLoading && (
              <div className="flex items-center gap-2 text-[11px] text-neutral-400 py-1">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <span>AI Copilot is responding…</span>
              </div>
            )}

            {/* Chat Error */}
            {chatError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-2.5 text-[11px] text-rose-300">
                {chatError}
              </div>
            )}

            <div ref={chatScrollRef} />
          </div>
        ) : (
          /* ==========================================================
           * JD TAILOR MODE VIEW
           * ========================================================== */
          <div className="space-y-4">
            {/* Global Error Banner */}
            {requestError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-300">
                <div className="flex items-center gap-1.5 font-semibold text-rose-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Action Failed</span>
                </div>
                <p className="mt-1 leading-relaxed">{requestError}</p>
              </div>
            )}

            {/* If no active JD session exists: Show Empty State */}
            {!activeJdSession || activeJdSession.status === "idle" ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center px-4">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#14151a] text-amber-400 shadow-inner">
                  <Briefcase className="h-6 w-6" strokeWidth={1.6} />
                </div>
                <h2 className="text-sm font-medium text-neutral-100">
                  Targeted Job Tailoring
                </h2>
                <p className="mt-1.5 max-w-[320px] text-[11.5px] leading-relaxed text-neutral-400">
                  Paste a job description below. RESUME AI will extract verified requirements, match evidence from your LaTeX resume, and suggest grounded edits for your review.
                </p>

                <div className="mt-6 w-full max-w-[320px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left">
                  <div className="text-[10px] font-semibold tracking-[0.14em] text-neutral-400 mb-1.5">
                    HOW IT WORKS
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-neutral-400">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-mono">1.</span>
                      <span>Indexes verified evidence from your resume files.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-mono">2.</span>
                      <span>Generates truthful, grounded LaTeX improvements.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-mono">3.</span>
                      <span>You review and accept or reject each suggestion.</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Active JD session exists: Display user JD entry + results */
              <>
                {/* 1. Submitted JD Entry (Rendered as user entry in panel) */}
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-amber-300">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>Submitted Job Description</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                      {activeJdSession.submittedAt && (
                        <span>
                          {new Date(activeJdSession.submittedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      <span className="capitalize font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-neutral-200 text-[9.5px]">
                        {activeJdSession.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] leading-relaxed text-neutral-300 whitespace-pre-wrap break-words">
                    {jdExpanded || (activeJdSession.jobDescription?.length ?? 0) <= 180
                      ? activeJdSession.jobDescription
                      : `${activeJdSession.jobDescription?.slice(0, 180)}…`}
                  </div>

                  {(activeJdSession.jobDescription?.length ?? 0) > 180 && (
                    <button
                      type="button"
                      onClick={() => setJdExpanded((prev) => !prev)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium"
                    >
                      {jdExpanded ? "Show less" : "Read full description"}
                    </button>
                  )}
                </div>

                {/* 2. Loading State */}
                {isJdAnalyzing && (
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#14151a] p-3.5 text-[11px] text-neutral-300">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
                    <div className="space-y-0.5">
                      <div className="font-medium text-neutral-200">
                        {activeJdSession.progressStep || "Analyzing resume against requirements…"}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        Verifying evidence citations & safety checks
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Error State */}
                {activeJdSession.status === "failed" && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-300 space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-200">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Analysis Failed</span>
                    </div>
                    <p className="leading-relaxed">
                      {activeJdSession.error || "Unable to complete tailoring analysis."}
                    </p>
                    {activeJdSession.jobDescription && (
                      <button
                        type="button"
                        onClick={() =>
                          void generateTailoringSuggestions(activeJdSession.jobDescription!)
                        }
                        className="inline-flex items-center gap-1 rounded bg-rose-600/80 px-2.5 py-1 text-[10.5px] font-medium text-white hover:bg-rose-500"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry Analysis
                      </button>
                    )}
                  </div>
                )}

                {/* 4. Completed State Results */}
                {activeJdSession.status === "completed" && (
                  <div className="space-y-3">
                    {/* Summary Bar */}
                    {activeJdSession.summary && (
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-neutral-400">
                        Analysis: {activeJdSession.summary.total} requirements ·{" "}
                        {activeJdSession.summary.strong} strong ·{" "}
                        {activeJdSession.summary.partial} partial ·{" "}
                        {activeJdSession.summary.missing} missing ·{" "}
                        {activeJdSession.summary.safeSuggestions} safe suggestions
                      </div>
                    )}

                    {/* Requirements Analysis */}
                    {activeJdSession.requirements.length > 0 && (
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <div className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-neutral-500">
                          REQUIREMENT ANALYSIS
                        </div>
                        <div className="space-y-1.5">
                          {activeJdSession.requirements.map((requirement) => (
                            <div
                              key={requirement.requirementId}
                              className="flex items-start justify-between gap-2 text-[10px]"
                            >
                              <span className="text-neutral-300">{requirement.text}</span>
                              <span className="shrink-0 font-mono text-neutral-500">
                                {requirement.classification ?? "UNASSESSED"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions Section Header */}
                    <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] text-neutral-500">
                      <span>
                        {visibleSuggestions.length} SUGGESTION
                        {visibleSuggestions.length === 1 ? "" : "S"}
                      </span>
                      {pendingCount > 0 && (
                        <span className="font-normal text-amber-400 tracking-normal">
                          {pendingCount} pending review
                        </span>
                      )}
                    </div>

                    {/* Empty suggestions check */}
                    {visibleSuggestions.length === 0 ? (
                      <div className="rounded-xl border border-white/[0.06] bg-[#14151a] p-4 text-center">
                        <h3 className="text-xs font-medium text-neutral-200">
                          Analysis completed with no safe suggestions
                        </h3>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
                          The analysis extracted {activeJdSession.requirements.length} requirements, but no modifications could be made without risking unsupported claims.
                        </p>
                      </div>
                    ) : (
                      /* Suggestion Cards */
                      visibleSuggestions.map((suggestion) => {
                        const expanded = expandedId === suggestion.suggestionId;
                        const isBusy = actionInProgress?.id === suggestion.suggestionId;
                        const isAnyBusy = actionInProgress !== null;
                        const isPending = suggestion.status === "pending";

                        return (
                          <div
                            key={suggestion.suggestionId}
                            className={`rounded-xl border transition-all ${
                              expanded
                                ? "border-white/[0.12] bg-[#14151a]"
                                : "border-white/[0.05] bg-[#121317] hover:border-white/[0.09]"
                            }`}
                          >
                            {/* Card Header */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(suggestion.suggestionId)}
                              className="flex w-full items-start gap-3 p-3 text-left leading-[1.45]"
                            >
                              <Edit3
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400"
                                strokeWidth={1.5}
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[12px] font-medium text-neutral-200">
                                    {suggestion.requirement}
                                  </span>
                                  <StatusBadge status={suggestion.status} />
                                </div>
                              </div>
                              <ChevronRight
                                className={`mt-1 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${
                                  expanded ? "rotate-90" : ""
                                }`}
                                strokeWidth={1.5}
                              />
                            </button>

                            {/* Expanded Content */}
                            {expanded && (
                              <div className="border-t border-white/[0.06] p-3 space-y-3">
                                {suggestion.before && (
                                  <div>
                                    <div className="mb-1 text-[9px] font-semibold tracking-[0.14em] text-neutral-500">
                                      BEFORE (CURRENT SOURCE)
                                    </div>
                                    <div className="rounded border border-rose-500/20 bg-rose-950/20 p-2 text-[11px] leading-relaxed text-neutral-300 font-mono break-words">
                                      {suggestion.before}
                                    </div>
                                  </div>
                                )}

                                {suggestion.after && (
                                  <div>
                                    <div className="mb-1 text-[9px] font-semibold tracking-[0.14em] text-neutral-500">
                                      AFTER (PROPOSED CHANGE)
                                    </div>
                                    <div className="rounded border border-emerald-500/20 bg-emerald-950/20 p-2 text-[11px] leading-relaxed text-neutral-100 font-mono break-words">
                                      {suggestion.after}
                                    </div>
                                  </div>
                                )}

                                {suggestion.reason && (
                                  <div>
                                    <div className="mb-1 text-[9px] font-semibold tracking-[0.14em] text-neutral-500">
                                      RATIONALE & EVIDENCE
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-neutral-400">
                                      {suggestion.reason}
                                    </p>
                                  </div>
                                )}

                                {/* Action Bar */}
                                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                                  <div className="text-[10px] text-neutral-500">
                                    Status:{" "}
                                    <span className="capitalize font-medium text-neutral-300">
                                      {suggestion.status}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isPending ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={isAnyBusy}
                                          onClick={() =>
                                            void handleDecision(suggestion.suggestionId, "reject")
                                          }
                                          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-neutral-300 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {isBusy && actionInProgress?.action === "reject"
                                            ? "Rejecting…"
                                            : "Reject"}
                                        </button>

                                        <button
                                          type="button"
                                          disabled={isAnyBusy}
                                          onClick={() =>
                                            void handleDecision(suggestion.suggestionId, "accept")
                                          }
                                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600/80 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                          {isBusy && actionInProgress?.action === "accept"
                                            ? "Applying…"
                                            : "Accept"}
                                        </button>
                                      </>
                                    ) : suggestion.status === "accepted" ||
                                      suggestion.status === "edited" ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Applied to resume source
                                      </span>
                                    ) : suggestion.status === "rejected" ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                                        <XCircle className="h-3.5 w-3.5 text-neutral-500" /> Suggestion rejected
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Suggestion unavailable
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                <div ref={jdScrollRef} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="shrink-0 p-3.5 border-t border-white/[0.06] bg-[#0c0d10]">
        <div className="flex items-end gap-2 rounded-2xl border border-white/[0.1] bg-[#16171d] px-3.5 py-2.5 shadow-sm focus-within:border-white/[0.2] transition-colors">
          <Paperclip className="h-4 w-4 shrink-0 text-neutral-500 mb-1" strokeWidth={1.6} />

          <textarea
            ref={textareaRef}
            rows={1}
            value={mode === "chat" ? chatInput : jdInput}
            onChange={(e) => {
              if (mode === "chat") setChatInput(e.target.value);
              else setJdInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitRequest();
              }
            }}
            placeholder={
              mode === "chat"
                ? "Ask AI Copilot a question... (Shift+Enter for newline)"
                : "Paste job description to tailor... (Shift+Enter for newline)"
            }
            className="min-w-0 flex-1 resize-none bg-transparent text-[11.5px] leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-500 max-h-28 overflow-y-auto"
            disabled={mode === "chat" ? isChatLoading : isJdAnalyzing}
          />

          <button
            type="button"
            aria-label="Send request"
            onClick={() => void submitRequest()}
            disabled={
              (mode === "chat"
                ? !chatInput.trim() || isChatLoading
                : !jdInput.trim() || isJdAnalyzing) || actionInProgress !== null
            }
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2a2c33] text-neutral-200 hover:bg-amber-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 transition-colors mb-0.5"
          >
            {mode === "chat" && isChatLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : mode === "jd" && isJdAnalyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

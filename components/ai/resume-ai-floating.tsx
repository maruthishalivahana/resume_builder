"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Paperclip,
  PanelRight,
  PenLine,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type AssistantMode = "empty" | "conversation" | "working" | "result";

interface ResumeAIChange {
  id: number;
  summary: string;
  before: string;
  after: string;
}

const changes: ResumeAIChange[] = [
  {
    id: 1,
    summary: "Reworded a bullet in the PROFILE",
    before: "Built scalable systems and improved team delivery.",
    after: "Built scalable systems that improved team delivery.",
  },
  {
    id: 2,
    summary: "Reworded 4 bullets in WhereAreYou — A Realtime College Bus Tracking Platform",
    before: "Worked on a platform for tracking college buses in real time.",
    after: "Built real-time college bus tracking workflows for students and operators.",
  },
  {
    id: 3,
    summary: "Reworded 4 bullets in Agentic Commerce Platform — AI-Powered Autonomous Commerce System",
    before: "Created AI-powered commerce features for autonomous shopping.",
    after: "Designed AI-powered commerce workflows for autonomous product discovery.",
  },
  {
    id: 4,
    summary: "Reworded 3 bullets in ReportMind AI — AI-Powered Document Analysis Platform",
    before: "Developed document analysis features using modern AI tools.",
    after: "Developed document analysis workflows with retrieval-aware AI tooling.",
  },
  {
    id: 5,
    summary: "Reworded 4 bullets in PetNest — Pet Marketplace Platform",
    before: "Improved the marketplace experience for pet owners.",
    after: "Improved marketplace workflows for pet owners and service providers.",
  },
  {
    id: 6,
    summary: "Tightened spacing between project sections",
    before: "Projects used generous vertical spacing throughout.",
    after: "Reduced section spacing while preserving scanability.",
  },
  {
    id: 7,
    summary: "Clarified the profile opening line",
    before: "Software engineer with experience across several technologies.",
    after: "Software engineer focused on reliable, production-ready systems.",
  },
  {
    id: 8,
    summary: "Standardized action verbs across experience bullets",
    before: "Helped with services and worked on system improvements.",
    after: "Delivered services and improved system reliability.",
  },
  {
    id: 9,
    summary: "Adjusted project bullet density",
    before: "Project details were distributed across long paragraphs.",
    after: "Project details now scan cleanly in concise bullets.",
  },
];

function ResumeAIIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Sparkles className="h-[0.85em] w-[0.85em]" strokeWidth={1.8} />
      <span className="absolute bottom-[0.08em] right-0 h-[0.28em] w-[0.28em] rounded-full bg-current" />
    </span>
  );
}

function ResumeAIHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex h-[53px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
      <div className="flex items-center gap-2.5">
        <ResumeAIIcon className="h-4 w-4 text-neutral-200" />
        <span className="text-[12px] font-semibold tracking-[0.11em] text-neutral-100">
          RESUME AI
        </span>
      </div>
      <div className="flex items-center gap-1 text-neutral-500">
        <button
          type="button"
          aria-label="Save assistant conversation"
          className="rounded-md p-1.5 transition-colors hover:bg-white/[0.05] hover:text-neutral-200"
        >
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Close RESUME AI"
          onClick={onClose}
          className="rounded-md p-1.5 transition-colors hover:bg-white/[0.05] hover:text-neutral-200"
        >
          <X className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>
    </header>
  );
}

function ChangeRow({
  change,
  expanded,
  onToggle,
}: {
  change: ResumeAIChange;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null);

  return (
    <div className="border-b border-white/[0.045] last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2.5 py-2.5 text-left text-[11px] leading-[1.45] text-neutral-300 transition-colors hover:text-white"
      >
        <Edit3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" strokeWidth={1.5} />
        <span className="min-w-0 flex-1">{change.summary}</span>
        <ChevronRight
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          strokeWidth={1.5}
        />
      </button>
      {expanded && (
        <div className="mb-3 ml-6 space-y-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
          <div>
            <div className="mb-1 text-[9px] font-semibold tracking-[0.14em] text-neutral-600">BEFORE</div>
            <p className="text-[11px] leading-relaxed text-neutral-500">{change.before}</p>
          </div>
          <div>
            <div className="mb-1 text-[9px] font-semibold tracking-[0.14em] text-neutral-600">AFTER</div>
            <p className="text-[11px] leading-relaxed text-neutral-200">{change.after}</p>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            {decision ? (
              <span className="text-[10px] text-neutral-500">
                {decision === "accepted" ? "Change accepted" : "Change rejected"}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setDecision("accepted")}
                  className="inline-flex items-center gap-1 rounded-md bg-white/[0.09] px-2.5 py-1 text-[10px] text-neutral-200 transition-colors hover:bg-white/[0.14]"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button
                  type="button"
                  className="rounded-md px-2.5 py-1 text-[10px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-200"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDecision("rejected")}
                  className="rounded-md px-2.5 py-1 text-[10px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-200"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResumeAIComposer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="shrink-0 p-4">
      <div className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#191a1f] px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <button
          type="button"
          aria-label="Attach context"
          className="shrink-0 text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <Paperclip className="h-4 w-4" strokeWidth={1.6} />
        </button>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
          placeholder="Ask for a change, or paste a job post"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-neutral-200 outline-none placeholder:text-neutral-500"
          disabled={disabled}
        />
        <button
          type="button"
          aria-label="Send request"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2a2c33] text-neutral-300 transition-colors hover:bg-[#373a43] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

export function ResumeAIFloating() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("empty");
  const [expandedChange, setExpandedChange] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const workingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (workingTimer.current) clearTimeout(workingTimer.current);
    };
  }, []);

  const submitRequest = () => {
    if (!input.trim() || mode === "working") return;
    setMode("working");
    workingTimer.current = setTimeout(() => setMode("result"), 650);
    setInput("");
  };

  const openConversation = () => {
    setIsOpen(true);
    setMode("conversation");
  };

  return (
    <>
      {isOpen && (
        <section
          aria-label="RESUME AI assistant"
          className="fixed bottom-4 right-4 z-[70] flex h-[min(740px,calc(100vh-32px))] w-[min(470px,calc(100vw-32px))] flex-col overflow-hidden rounded-[18px] border border-white/[0.1] bg-[#101114] text-neutral-200 shadow-[0_24px_70px_rgba(0,0,0,0.52)]"
        >
          <ResumeAIHeader onClose={() => setIsOpen(false)} />
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-5 text-[10px] text-neutral-600">
                {mode === "empty" ? "Resume workspace" : "main.tex · Technical Projects"}
              </div>

              {mode === "empty" ? (
                <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-neutral-400">
                    <ResumeAIIcon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-medium text-neutral-200">What should we improve?</h2>
                  <p className="mt-2 max-w-[260px] text-[11px] leading-relaxed text-neutral-500">
                    Ask RESUME AI to tighten wording, improve structure, or tailor your resume.
                  </p>
                  <button
                    type="button"
                    onClick={openConversation}
                    className="mt-5 rounded-full border border-white/[0.1] px-3 py-1.5 text-[10px] text-neutral-400 transition-colors hover:bg-white/[0.05] hover:text-neutral-200"
                  >
                    Review this resume
                  </button>
                </div>
              ) : mode === "working" ? (
                <div className="flex min-h-[430px] items-center justify-center gap-2 text-[11px] text-neutral-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
                  RESUME AI is reviewing the document
                </div>
              ) : (
                <>
                  <div className="ml-auto max-w-[368px] rounded-[17px] bg-[#222328] px-4 py-3 text-[12px] leading-relaxed text-neutral-200">
                    Get my resume onto one page. Tighten wording and spacing first; ask me before cutting anything.
                  </div>
                  <div className="mt-5 flex items-center gap-2 text-[11px] text-neutral-500">
                    <Check className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.5} />
                    <span>Edited the resume, looked at the page</span>
                    <span className="ml-auto text-[10px]">49s</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-600" strokeWidth={1.5} />
                  </div>
                  <p className="mt-5 max-w-[390px] text-[12px] leading-[1.8] text-neutral-300">
                    It now fits on one page. I tightened the profile and project bullets and reduced spacing; no cuts were needed.
                  </p>
                  <div className="mt-5 rounded-[12px] border border-white/[0.1] px-4 py-3">
                    <div className="mb-2 text-[10px] font-semibold tracking-[0.1em] text-neutral-500">
                      9 CHANGES
                    </div>
                    {(mode === "result" ? changes : changes.slice(0, 5)).map((change) => (
                      <ChangeRow
                        key={change.id}
                        change={change}
                        expanded={expandedChange === change.id}
                        onToggle={() =>
                          setExpandedChange((current) => (current === change.id ? null : change.id))
                        }
                      />
                    ))}
                    {mode === "conversation" && (
                      <button
                        type="button"
                        onClick={() => setMode("result")}
                        className="flex w-full items-center justify-center gap-2 pt-3 text-[10px] text-neutral-500 transition-colors hover:text-neutral-300"
                      >
                        and 4 more <ChevronDown className="h-3.5 w-3.5 rounded-full bg-white/[0.08] p-0.5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <ResumeAIComposer
              value={input}
              onChange={setInput}
              onSubmit={submitRequest}
              disabled={mode === "working"}
            />
          </div>
        </section>
      )}

      {!isOpen && (
        <button
          type="button"
          aria-label="Open RESUME AI"
          title="Chat with RESUME AI · Ctrl+J"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[65] flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.14] bg-[#111216] text-neutral-300 shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-0.5 hover:border-white/[0.25] hover:bg-[#191a1f] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <ResumeAIIcon className="h-5 w-5" />
        </button>
      )}
    </>
  );
}

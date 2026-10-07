"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Code2,
  Sparkles,
  Download,
  Briefcase,
  Layers,
  Settings,
  Plus,
  Play,
  ArrowRight,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Actions" | "AI & Match";
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { compileLatex, resetToMaster, toggleAIAssistant, openAIAssistantForATS, openAIAssistantForJD } = useResume();

  const commands: CommandItem[] = [
    {
      id: "nav_editor",
      title: "Open Structured Editor",
      category: "Navigation",
      icon: <FileText className="w-4 h-4 text-neutral-400" />,
      shortcut: "G E",
      action: () => router.push("/resume/demo/editor"),
    },
    {
      id: "nav_latex",
      title: "Open LaTeX Workspace",
      category: "Navigation",
      icon: <Code2 className="w-4 h-4 text-sky-400" />,
      shortcut: "G L",
      action: () => router.push("/resume/demo/latex"),
    },
    {
      id: "nav_preview",
      title: "Open Fullscreen PDF Preview",
      category: "Navigation",
      icon: <Download className="w-4 h-4 text-neutral-400" />,
      shortcut: "⌘ ⇧ P",
      action: () => router.push("/resume/demo/preview"),
    },
    {
      id: "nav_ats",
      title: "Open ATS Analysis & Diagnostic Report",
      category: "Navigation",
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      shortcut: "G A",
      action: () => router.push("/resume/demo/ats"),
    },
    {
      id: "act_ai_assistant",
      title: "Toggle Contextual AI Assistant (✦ AI)",
      category: "AI & Match",
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      shortcut: "✦ AI",
      action: () => toggleAIAssistant(),
    },
    {
      id: "act_ats_fix",
      title: "Fix ATS Issues with AI",
      category: "AI & Match",
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      action: () => openAIAssistantForATS(),
    },
    {
      id: "act_jd_match",
      title: "Job Description Alignment in AI Assistant",
      category: "AI & Match",
      icon: <Briefcase className="w-4 h-4 text-sky-400" />,
      action: () => openAIAssistantForJD(),
    },
    {
      id: "act_compile",
      title: "Compile LaTeX Document",
      category: "Actions",
      icon: <Play className="w-4 h-4 text-emerald-400" />,
      shortcut: "⌘ ↵",
      action: () => {
        compileLatex();
        router.push("/resume/demo/latex");
      },
    },
    {
      id: "nav_dashboard",
      title: "Go to Dashboard",
      category: "Navigation",
      icon: <Layers className="w-4 h-4 text-neutral-400" />,
      shortcut: "G D",
      action: () => router.push("/dashboard"),
    },
    {
      id: "act_new_resume",
      title: "Create New Resume Variant",
      category: "Actions",
      icon: <Plus className="w-4 h-4 text-neutral-400" />,
      action: () => router.push("/resume/new"),
    },
    {
      id: "act_reset_master",
      title: "Reset to Clean Master Resume",
      category: "Actions",
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      action: () => resetToMaster(),
    },
    {
      id: "nav_settings",
      title: "Open Settings",
      category: "Navigation",
      icon: <Settings className="w-4 h-4 text-neutral-400" />,
      shortcut: "⌘ ,",
      action: () => router.push("/settings"),
    },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        compileLatex();
      }
    },
    [compileLatex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const executeSelected = (index: number) => {
    const cmd = filtered[index];
    if (cmd) {
      cmd.action();
      setIsOpen(false);
      setQuery("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-xl border border-white/10 bg-[#0E0E10] shadow-2xl overflow-hidden text-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#121214]">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search workspace... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                executeSelected(selectedIndex);
              }
            }}
            className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-white/5 border border-white/10 rounded">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => executeSelected(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors duration-100 ${
                  idx === selectedIndex
                    ? "bg-white/[0.08] text-white"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="p-1 rounded bg-white/[0.04] border border-white/5">{cmd.icon}</span>
                  <div>
                    <span className="font-medium">{cmd.title}</span>
                    <span className="ml-2 text-[10px] text-neutral-500">({cmd.category})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cmd.shortcut && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-neutral-400">
                      {cmd.shortcut}
                    </span>
                  )}
                  <ArrowRight className={`w-3.5 h-3.5 transition-opacity ${idx === selectedIndex ? "opacity-100 text-white" : "opacity-0"}`} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/8 bg-[#09090B] text-[11px] text-neutral-500">
          <div className="flex items-center gap-3">
            <span>Navigation <kbd className="px-1 bg-white/5 rounded text-[10px]">↑↓</kbd></span>
            <span>Select <kbd className="px-1 bg-white/5 rounded text-[10px]">↵</kbd></span>
          </div>
          <span className="text-[10px] text-neutral-600 font-mono">⌘K Command Surface</span>
        </div>
      </div>
    </div>
  );
}

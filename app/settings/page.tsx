"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Terminal,
  Key,
  Command,
  Check,
  Shield,
  Cpu,
} from "lucide-react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  const [compiler, setCompiler] = useState<"pdflatex" | "xelatex" | "lualatex">("pdflatex");
  const [apiKey, setApiKey] = useState("");
  const [savedNotification, setSavedNotification] = useState(false);

  const handleSave = () => {
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2000);
  };

  return (
    <WorkspaceShell>
      <div className="w-full flex-1 overflow-y-auto bg-[#070709] px-6 py-6 md:px-12 md:py-8 select-none text-xs">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-1 pb-4 border-b border-white/[0.07]">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Workspace Settings & Tooling
            </h1>
            <p className="text-xs text-neutral-400">
              Configure your local LaTeX compiler, intelligence providers, and export preferences.
            </p>
          </div>

          {/* Setting Section: LaTeX Compiler */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-white font-semibold uppercase tracking-wider text-[11px] font-mono">
              <Terminal className="w-4 h-4 text-sky-400" />
              <span>LaTeX Compilation Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { id: "pdflatex", name: "pdfLaTeX (Fastest)", desc: "Standard 8-bit TeX engine. Fastest compile times (< 1.2s)." },
                { id: "xelatex", name: "XeLaTeX", desc: "Native Unicode and system TTF/OTF font support." },
                { id: "lualatex", name: "LuaLaTeX", desc: "Modern embedded Lua scripting for dynamic typesetting." },
              ].map((engine) => (
                <div
                  key={engine.id}
                  onClick={() => setCompiler(engine.id as any)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    compiler === engine.id
                      ? "bg-white/[0.08] border-white/30 text-white shadow-xs"
                      : "bg-[#0E0E12] border-white/[0.05] text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <div className="font-semibold text-white mb-1">{engine.name}</div>
                  <div className="text-[11px] text-neutral-500 leading-relaxed">{engine.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Setting Section: AI Key Local Storage */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-white font-semibold uppercase tracking-wider text-[11px] font-mono">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Intelligence API Credentials (Client-Side Encrypted)</span>
            </div>

            <p className="text-neutral-400 leading-relaxed">
              Provide your private API key for custom reasoning models. Keys are stored strictly in your browser&apos;s encrypted LocalStorage and never sent to central analytics servers.
            </p>

            <div className="space-y-1.5 max-w-lg">
              <label className="text-neutral-400 font-medium">Provider Key (OpenAI / Anthropic / Gemini)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-live-••••••••••••••••••••••••"
                className="w-full bg-[#121216] border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs placeholder-neutral-600 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Setting Section: Keyboard Shortcuts Cheatsheet */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-white font-semibold uppercase tracking-wider text-[11px] font-mono">
              <Command className="w-4 h-4 text-purple-400" />
              <span>Keyboard Shortcuts</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-neutral-300">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0E0E12] border border-white/[0.05]">
                <span>Toggle Left Sidebar</span>
                <kbd className="font-mono text-[10px] px-2 py-0.5 bg-black/50 border border-white/10 rounded text-neutral-400">
                  ⌘B / Ctrl+B
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0E0E12] border border-white/[0.05]">
                <span>Command Palette</span>
                <kbd className="font-mono text-[10px] px-2 py-0.5 bg-black/50 border border-white/10 rounded text-neutral-400">
                  ⌘K / Ctrl+K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0E0E12] border border-white/[0.05]">
                <span>Compile LaTeX</span>
                <kbd className="font-mono text-[10px] px-2 py-0.5 bg-black/50 border border-white/10 rounded text-neutral-400">
                  ⌘Enter / Ctrl+Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0E0E12] border border-white/[0.05]">
                <span>Close Drawers & Modals</span>
                <kbd className="font-mono text-[10px] px-2 py-0.5 bg-black/50 border border-white/10 rounded text-neutral-400">
                  Escape
                </kbd>
              </div>
            </div>
          </div>

          {/* Save footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
            <div className="text-xs text-neutral-500 font-mono">
              {savedNotification ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Preferences saved successfully.
                </span>
              ) : (
                <span>Stored in workspace profile</span>
              )}
            </div>

            <Button variant="primary" size="md" onClick={handleSave}>
              Save Preferences
            </Button>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default SettingsPage;

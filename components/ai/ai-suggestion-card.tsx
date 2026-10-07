"use client";

import React, { useState } from "react";
import { Sparkles, Check, X, Edit3, ArrowRight, ShieldCheck } from "lucide-react";
import { AISuggestion } from "@/types/resume";
import { Button } from "@/components/ui/button";

interface AISuggestionCardProps {
  suggestion: AISuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onClose: () => void;
}

export function AISuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onClose,
}: AISuggestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customText, setCustomText] = useState(suggestion.suggestedText);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-[#0E0E12] shadow-2xl p-4 text-xs space-y-3.5 relative overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Glow accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400/60 via-sky-400/40 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-3 h-3" />
          </div>
          <div>
            <span className="font-semibold text-neutral-200">Contextual AI Suggestion</span>
            <span className="ml-2 font-mono text-[10px] text-amber-400/80 px-1 py-0.2 rounded bg-amber-400/10">
              High Confidence
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 transition-colors p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Diff Presentation */}
      <div className="space-y-2 rounded-lg bg-[#070709] p-3 border border-white/[0.06]">
        <div>
          <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider mb-1">
            Original
          </div>
          <div className="text-neutral-400 leading-relaxed pl-2 border-l-2 border-rose-500/40 line-through decoration-rose-500/60">
            {suggestion.originalText}
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase font-semibold text-amber-400 tracking-wider">
              Suggested Enhancement
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <Edit3 className="w-2.5 h-2.5" /> Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={3}
              className="w-full bg-[#121216] border border-white/10 rounded p-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-400/50 leading-relaxed font-sans"
            />
          ) : (
            <div className="text-neutral-200 font-medium leading-relaxed pl-2 border-l-2 border-amber-400">
              {suggestion.suggestedText}
            </div>
          )}
        </div>
      </div>

      {/* Rationale & Grounding Evidence */}
      <div className="space-y-2 bg-[#121216]/60 p-2.5 rounded-lg border border-white/[0.04]">
        <div className="text-neutral-300">
          <span className="font-semibold text-neutral-400">Why: </span>
          {suggestion.rationale}
        </div>

        <div className="space-y-1 pt-1">
          <div className="text-[10px] uppercase font-semibold text-neutral-500 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Grounded Evidence
          </div>
          <ul className="space-y-0.5 pl-1">
            {suggestion.evidence.map((ev, i) => (
              <li key={i} className="text-[11px] text-neutral-400 flex items-start gap-1.5">
                <span className="text-emerald-400 text-xs">✓</span>
                <span>{ev}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReject(suggestion.id)}
          className="text-neutral-400 hover:text-neutral-200"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reject</span>
        </Button>

        <Button
          variant="accent"
          size="sm"
          onClick={() => onAccept(suggestion.id)}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Accept Suggestion</span>
        </Button>
      </div>
    </div>
  );
}

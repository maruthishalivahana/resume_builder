"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  Building2,
  MapPin,
  Calendar,
  Briefcase,
  Layers,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { ExperienceItem, BulletPoint } from "@/types/resume";
import { AISuggestionCard } from "@/components/ai/ai-suggestion-card";
import { Button } from "@/components/ui/button";

export function BlockEditor() {
  const {
    resume,
    activeSectionId,
    selectedBulletId,
    activeSuggestion,
    updateExperience,
    updateBullet,
    addBullet,
    deleteBullet,
    addExperience,
    deleteExperience,
    triggerAIForBullet,
    acceptAISuggestion,
    rejectAISuggestion,
    setActiveSuggestion,
  } = useResume();

  const [editingBulletId, setEditingBulletId] = useState<string | null>(null);
  const [editingExpHeaderId, setEditingExpHeaderId] = useState<string | null>(null);

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0C] overflow-y-auto">
      {/* Top Section Banner */}
      <div className="p-6 border-b border-white/[0.06] bg-gradient-to-b from-[#111115] to-[#0A0A0C]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-semibold text-white tracking-tight">
                {activeSectionId === "sec_experience"
                  ? "Professional Experience"
                  : activeSectionId === "sec_projects"
                  ? "Technical Projects"
                  : activeSectionId === "sec_skills"
                  ? "Technical Skills"
                  : "Resume Section"}
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Inline structured blocks with telemetry and contextual AI optimization.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addExperience}
            className="text-xs border-white/10 hover:border-white/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Position</span>
          </Button>
        </div>
      </div>

      {/* Main Blocks Area */}
      <div className="p-6 space-y-8 max-w-4xl">
        {/* Contextual AI Suggestion Card Float / Dock if active */}
        {activeSuggestion && (
          <div className="sticky top-2 z-30 mb-6">
            <AISuggestionCard
              suggestion={activeSuggestion}
              onAccept={acceptAISuggestion}
              onReject={rejectAISuggestion}
              onClose={() => setActiveSuggestion(null)}
            />
          </div>
        )}

        {/* Experience Blocks */}
        {resume.experience.map((exp, index) => (
          <div
            key={exp.id}
            className="group relative rounded-xl border border-white/[0.08] bg-[#0E0E12]/80 hover:border-white/[0.18] transition-all duration-200 p-5 space-y-4"
          >
            {/* Header: Role, Company, Location, Dates with Inline Edit */}
            <div className="flex items-start justify-between border-b border-white/[0.05] pb-4">
              <div className="space-y-1.5 flex-1 pr-4">
                {editingExpHeaderId === exp.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      value={exp.role}
                      onChange={(e) => updateExperience(exp.id, { role: e.target.value })}
                      placeholder="Job Title"
                      className="bg-[#16161B] px-2.5 py-1.5 rounded border border-white/10 text-white font-medium focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => updateExperience(exp.id, { company: e.target.value })}
                      placeholder="Company Name"
                      className="bg-[#16161B] px-2.5 py-1.5 rounded border border-white/10 text-white font-medium focus:outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={exp.location}
                      onChange={(e) => updateExperience(exp.id, { location: e.target.value })}
                      placeholder="Location"
                      className="bg-[#16161B] px-2.5 py-1.5 rounded border border-white/10 text-neutral-300 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={exp.startDate}
                        onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })}
                        placeholder="Start Date"
                        className="bg-[#16161B] px-2.5 py-1.5 rounded border border-white/10 text-neutral-300 w-1/2 focus:outline-none focus:border-amber-400"
                      />
                      <input
                        type="text"
                        value={exp.endDate}
                        onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })}
                        placeholder="End Date"
                        className="bg-[#16161B] px-2.5 py-1.5 rounded border border-white/10 text-neutral-300 w-1/2 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white tracking-tight">
                        {exp.role}
                      </span>
                      <span className="text-neutral-500 text-xs">·</span>
                      <span className="text-sm font-medium text-neutral-300 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                        {exp.company}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-600" />
                        {exp.location}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-neutral-400">
                        <Calendar className="w-3 h-3 text-neutral-600" />
                        {exp.startDate} — {exp.isCurrent ? "Present" : exp.endDate}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Header Context Controls */}
              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() =>
                    setEditingExpHeaderId((prev) => (prev === exp.id ? null : exp.id))
                  }
                  className="p-1.5 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                  title="Toggle Edit Header"
                >
                  {editingExpHeaderId === exp.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Edit2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => deleteExperience(exp.id)}
                  className="p-1.5 rounded hover:bg-rose-950/40 text-neutral-500 hover:text-rose-400 transition-colors"
                  title="Delete Position"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bullets List */}
            <div className="space-y-2.5">
              <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                Accomplishments & Impact Bullets
              </div>

              {exp.bullets.map((bullet) => {
                const isSelected = selectedBulletId === bullet.id;
                const isEditingThis = editingBulletId === bullet.id;

                return (
                  <div
                    key={bullet.id}
                    className={`group/bullet relative rounded-lg border transition-all duration-150 p-3 text-xs leading-relaxed ${
                      isSelected
                        ? "border-amber-400/50 bg-[#16161D] shadow-md ring-1 ring-amber-400/20"
                        : "border-white/[0.05] bg-[#0A0A0E] hover:border-white/[0.12] hover:bg-[#101014]"
                    }`}
                  >
                    {isEditingThis ? (
                      <div className="space-y-2">
                        <textarea
                          value={bullet.text}
                          onChange={(e) => updateBullet(exp.id, bullet.id, e.target.value)}
                          rows={2}
                          autoFocus
                          className="w-full bg-[#181820] text-neutral-200 border border-white/10 rounded p-2 text-xs focus:outline-none focus:border-amber-400 leading-relaxed font-sans"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setEditingBulletId(null)}
                          >
                            Done Editing
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1">
                          <span className="text-amber-400/70 select-none font-bold mt-0.5">•</span>
                          <p
                            onClick={() => setEditingBulletId(bullet.id)}
                            className="text-neutral-300 cursor-text hover:text-white transition-colors"
                          >
                            {bullet.text}
                          </p>
                        </div>

                        {/* Contextual Floating Actions upon hovering a bullet */}
                        <div className="flex items-center gap-1 opacity-0 group-hover/bullet:opacity-100 transition-opacity bg-[#14141A] border border-white/10 rounded-md p-0.5 shadow-lg shrink-0">
                          <button
                            onClick={() => triggerAIForBullet(bullet.id, bullet.text)}
                            className="px-2 py-1 rounded hover:bg-amber-400/15 text-amber-300 font-medium text-[11px] flex items-center gap-1 transition-colors"
                            title="AI Polish & Quantify"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>AI Polish</span>
                          </button>

                          <div className="w-px h-3 bg-white/10" />

                          <button
                            onClick={() => setEditingBulletId(bullet.id)}
                            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => deleteBullet(exp.id, bullet.id)}
                            className="p-1 rounded hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Bullet Button */}
              <button
                onClick={() => addBullet(exp.id)}
                className="w-full py-2 border border-dashed border-white/10 hover:border-white/25 rounded-lg text-neutral-500 hover:text-neutral-200 transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Achievement Bullet</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

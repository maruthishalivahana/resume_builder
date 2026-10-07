"use client";

import React from "react";
import {
  GripVertical,
  Briefcase,
  FolderGit2,
  Cpu,
  GraduationCap,
  Award,
  User,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { ResumeSectionMeta } from "@/types/resume";

export function StructurePanel() {
  const { resume, activeSectionId, setActiveSectionId, reorderSections, addExperience } =
    useResume();

  const getSectionIcon = (type: ResumeSectionMeta["type"]) => {
    switch (type) {
      case "personal":
        return <User className="w-3.5 h-3.5" />;
      case "experience":
        return <Briefcase className="w-3.5 h-3.5 text-sky-400" />;
      case "projects":
        return <FolderGit2 className="w-3.5 h-3.5 text-amber-400" />;
      case "skills":
        return <Cpu className="w-3.5 h-3.5 text-emerald-400" />;
      case "education":
        return <GraduationCap className="w-3.5 h-3.5 text-purple-400" />;
      case "certifications":
        return <Award className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Briefcase className="w-3.5 h-3.5" />;
    }
  };

  const toggleVisibility = (secId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = resume.sections.map((sec) =>
      sec.id === secId ? { ...sec, visible: !sec.visible } : sec
    );
    reorderSections(updated);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#09090B] border-r border-white/[0.08] select-none text-xs">
      {/* Panel Header */}
      <div className="p-3 border-b border-white/[0.08] flex items-center justify-between">
        <div>
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            Resume Structure
          </span>
          <p className="text-[10px] text-neutral-600">Reorder & organize sections</p>
        </div>
        <button
          onClick={addExperience}
          title="Add Experience"
          className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {resume.sections.map((sec) => {
          const isActive = activeSectionId === sec.id;
          return (
            <div key={sec.id} className="space-y-1">
              <div
                onClick={() => setActiveSectionId(sec.id)}
                className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? "bg-white/[0.09] text-white border border-white/10 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3.5 h-3.5 text-neutral-600 opacity-40 group-hover:opacity-100 transition-opacity cursor-grab" />
                  <span className="text-neutral-400">{getSectionIcon(sec.type)}</span>
                  <span className="font-medium text-xs truncate">{sec.title}</span>
                </div>

                <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => toggleVisibility(sec.id, e)}
                    className="p-1 hover:text-white transition-colors"
                    title={sec.visible ? "Hide section" : "Show section"}
                  >
                    {sec.visible ? (
                      <Eye className="w-3 h-3 text-neutral-400" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-neutral-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sub-items for Experience when active */}
              {sec.type === "experience" && (
                <div className="ml-6 pl-2 border-l border-white/[0.06] space-y-0.5">
                  {resume.experience.map((exp) => (
                    <div
                      key={exp.id}
                      onClick={() => setActiveSectionId("sec_experience")}
                      className="px-2 py-1.5 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02] cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate">{exp.company}</span>
                      <span className="text-[10px] text-neutral-600 font-mono">
                        {exp.bullets.length}b
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-items for Projects when active */}
              {sec.type === "projects" && (
                <div className="ml-6 pl-2 border-l border-white/[0.06] space-y-0.5">
                  {resume.projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => setActiveSectionId("sec_projects")}
                      className="px-2 py-1.5 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.02] cursor-pointer truncate"
                    >
                      {proj.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0A0A0C] text-[10px] text-neutral-500 flex items-center justify-between">
        <span>6 Sections visible</span>
        <span className="font-mono text-neutral-600">v2.4</span>
      </div>
    </div>
  );
}

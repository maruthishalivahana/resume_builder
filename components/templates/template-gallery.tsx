"use client";

import { useResume } from "@/hooks/use-resume";
import React, { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, Eye, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TemplateItem {
  id: string;
  name: string;
  tagline: string;
  category: "Technical" | "Minimal" | "Executive";
  atsScore: number;
  description: string;
  accent: string;
}

export function TemplateGallery() {
  const { resumeBasePath } = useResume();
  const [selectedTemplate, setSelectedTemplate] = useState("modern-engineer");

  const templates: TemplateItem[] = [
    {
      id: "modern-engineer",
      name: "Modern Engineer (Jake's CV)",
      tagline: "The industry standard for Software, Systems & DevOps",
      category: "Technical",
      atsScore: 99,
      description: "Clean single-column LaTeX hierarchy, compact margin spacing, zero ATS parsing friction.",
      accent: "#38BDF8",
    },
    {
      id: "minimalist-latex",
      name: "Minimalist Academic",
      tagline: "Computer Modern typography for research & AI labs",
      category: "Minimal",
      atsScore: 98,
      description: "Classical TeX styling designed for researchers, Staff Engineers, and PhD candidates.",
      accent: "#DCA744",
    },
    {
      id: "executive-serif",
      name: "Executive Leadership",
      tagline: "High-contrast serif layout for VP & Director candidates",
      category: "Executive",
      atsScore: 96,
      description: "Sophisticated editorial hierarchy highlighting business metrics, headcount, and budget P&L.",
      accent: "#A78BFA",
    },
    {
      id: "clean-mono",
      name: "DevOps / Systems Mono",
      tagline: "Monospace accents for infrastructure & security specialists",
      category: "Technical",
      atsScore: 97,
      description: "Technical tabular format tailored for low-level systems, kernel, and security engineers.",
      accent: "#34D399",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {templates.map((tpl) => {
          const isSelected = selectedTemplate === tpl.id;

          return (
            <div
              key={tpl.id}
              onClick={() => setSelectedTemplate(tpl.id)}
              className={`group relative rounded-xl border transition-all duration-200 p-4 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-[#111116] border-amber-400/50 shadow-xl ring-1 ring-amber-400/20"
                  : "bg-[#09090C] border-white/[0.08] hover:border-white/20 hover:bg-[#0D0D11]"
              }`}
            >
              {/* Paper Preview Mockup */}
              <div className="w-full aspect-[1/1.3] bg-white rounded-sm shadow-md p-3 relative overflow-hidden flex flex-col justify-between mb-4 group-hover:scale-[1.01] transition-transform">
                {/* Paper mini lines */}
                <div className="space-y-1.5 opacity-80">
                  <div className="h-2 w-1/3 bg-neutral-900 rounded-xs mx-auto" />
                  <div className="h-1 w-1/2 bg-neutral-400 rounded-xs mx-auto" />
                  <div className="h-px bg-neutral-300 my-1" />
                  <div className="h-1.5 w-1/4 bg-neutral-800 rounded-xs" />
                  <div className="h-1 w-full bg-neutral-300 rounded-xs" />
                  <div className="h-1 w-5/6 bg-neutral-300 rounded-xs" />
                  <div className="h-1 w-4/5 bg-neutral-300 rounded-xs" />
                  <div className="h-1.5 w-1/4 bg-neutral-800 rounded-xs mt-2" />
                  <div className="h-1 w-full bg-neutral-300 rounded-xs" />
                  <div className="h-1 w-3/4 bg-neutral-300 rounded-xs" />
                </div>

                {/* ATS Badge */}
                <div className="text-[9px] font-mono text-neutral-800 font-bold bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-300 self-start">
                  ATS: {tpl.atsScore}%
                </div>

                {/* Hover overlay with button */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                  <span className="text-xs font-semibold text-white bg-white/20 px-3 py-1.5 rounded-lg border border-white/30 backdrop-blur-sm">
                    {isSelected ? "Selected" : "Use Template"}
                  </span>
                </div>
              </div>

              {/* Template details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white text-xs tracking-tight">{tpl.name}</h4>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2">
                  {tpl.description}
                </p>
              </div>

              {/* Tagline */}
              <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                <span>{tpl.category}</span>
                <span className="text-emerald-400">100% LaTeX</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
        <div className="text-xs text-neutral-400">
          Selected: <span className="font-medium text-white">{selectedTemplate}</span> (Standard ATS-verified LaTeX format)
        </div>

        <Link href={`${resumeBasePath}/editor`}>
          <Button variant="primary" size="md">
            <span>Continue to Editor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { ArrowLeft, Sparkles, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NewResumePage() {
  const router = useRouter();
  const [roleTitle, setRoleTitle] = useState("Staff Distributed Systems Engineer");
  const [targetCompany, setTargetCompany] = useState("Stripe / OpenAI");

  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 md:p-10 space-y-8">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-200">New Resume Variant</span>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Create Resume Variant
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
            Choose a clean, ATS-compliant LaTeX template. Your master profile and verified telemetry
            will be loaded automatically.
          </p>
        </div>

        {/* Role Targeting Configuration Form */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0E] p-5 space-y-4">
          <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Targeting & Role Metadata
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-neutral-400 font-medium">Target Role</label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full bg-[#121216] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-neutral-400 font-medium">Target Company or Industry</label>
              <input
                type="text"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                placeholder="e.g. Stripe, Anthropic, FinTech"
                className="w-full bg-[#121216] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Template Gallery */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Select LaTeX Base Template
            </div>
            <span className="text-xs text-neutral-500 font-mono">4 verified templates</span>
          </div>

          <TemplateGallery />
        </div>
      </main>
    </div>
  );
}

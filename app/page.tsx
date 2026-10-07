"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Code2,
  FileText,
  Sparkles,
  Briefcase,
  GitBranch,
  ShieldCheck,
  Check,
  Terminal,
  Cpu,
  Layers,
  ChevronRight,
  Download,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"editor" | "latex" | "jobs">("editor");

  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED] flex flex-col selection:bg-amber-400/20">
      {/* Top Floating Glass Navigation */}
      <header className="sticky top-0 z-50 h-14 border-b border-white/[0.07] bg-[#070709]/80 backdrop-blur-xl px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400/20 to-sky-400/20 border border-white/20 flex items-center justify-center font-mono text-[11px] font-bold text-white">
            R
          </div>
          <span className="font-semibold text-xs tracking-wider text-neutral-200">
            RESUME<span className="text-amber-400 font-mono">.ENG</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-xs text-neutral-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#latex" className="hover:text-white transition-colors">LaTeX Engine</a>
          <Link href="/resume/demo/ats" className="hover:text-white transition-colors">ATS Analysis</Link>
          <a href="#templates" className="hover:text-white transition-colors">Templates</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs text-neutral-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/resume/demo/editor">
            <Button variant="primary" size="sm">
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 max-w-6xl mx-auto flex flex-col items-center text-center">
        {/* Glow ambient background */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/[0.07] via-sky-500/[0.04] to-transparent blur-3xl pointer-events-none" />

        {/* Category Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-neutral-300 font-mono mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>Professional Resume Engineering Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white max-w-4xl leading-[1.08]">
          Your resume.
          <br />
          <span className="bg-gradient-to-r from-neutral-200 via-neutral-400 to-amber-200/90 bg-clip-text text-transparent">
            Engineered for the job.
          </span>
        </h1>

        {/* Supporting Text */}
        <p className="mt-6 text-sm sm:text-base text-neutral-400 max-w-2xl leading-relaxed">
          Build a precise, professional resume with structured editing, LaTeX control, and grounded AI assistance.
          Designed for technical leaders and software craftspeople.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
          <Link href="/resume/demo/editor">
            <Button variant="primary" size="lg" className="px-6">
              <span>Create your resume</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>

          <Link href="/dashboard">
            <Button variant="secondary" size="lg" className="px-6">
              <span>Explore workspace</span>
            </Button>
          </Link>
        </div>

        {/* Trust metrics */}
        <div className="mt-12 flex items-center gap-8 text-[11px] text-neutral-500 font-mono">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 100% Deterministic LaTeX
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-sky-400" /> Zero ATS Hallucinations
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Traceable Grounding
          </span>
        </div>
      </section>

      {/* Floating Product Preview Showcase */}
      <section className="px-4 sm:px-8 max-w-6xl mx-auto w-full pb-24">
        <div className="rounded-2xl border border-white/[0.12] bg-[#0A0A0E] shadow-2xl overflow-hidden">
          {/* Mock Window Title Bar */}
          <div className="h-10 border-b border-white/[0.08] px-4 bg-[#0F0F14] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="ml-3 font-mono text-[11px] text-neutral-400">
                master_resume.eng · Apex Distributed Labs
              </span>
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-white/5 text-[11px]">
              <button
                onClick={() => setActiveTab("editor")}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  activeTab === "editor" ? "bg-white/10 text-white font-medium" : "text-neutral-500"
                }`}
              >
                Structured Editor
              </button>
              <button
                onClick={() => setActiveTab("latex")}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  activeTab === "latex" ? "bg-white/10 text-white font-medium" : "text-neutral-500"
                }`}
              >
                LaTeX Engine
              </button>
              <button
                onClick={() => setActiveTab("jobs")}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  activeTab === "jobs" ? "bg-white/10 text-white font-medium" : "text-neutral-500"
                }`}
              >
                JD Alignment (92%)
              </button>
            </div>
          </div>

          {/* Interactive Split Workspace Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
            {/* Left Column: Interactive UI Showcase (7 cols) */}
            <div className="lg:col-span-7 p-6 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#08080B] flex flex-col justify-between">
              {activeTab === "editor" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-semibold text-white uppercase tracking-wider text-[10px]">
                      Interactive Structured Editor
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">Synchronized ✓</span>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-[#0E0E14] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white text-xs">Senior Software Engineer</div>
                        <div className="text-[11px] text-neutral-500">
                          Apex Distributed Labs · San Francisco, CA · 2024 — Present
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                        Active
                      </span>
                    </div>

                    {/* Bullet with AI enhancement */}
                    <div className="p-3 rounded-lg bg-[#14141C] border border-amber-400/40 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-neutral-200 leading-relaxed">
                          Architected distributed caching and event streaming layer using Apache Kafka and Redis cluster, reducing p99 API latency from 320ms to 42ms under 85,000 peak RPS.
                        </p>
                        <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[10px] font-mono shrink-0">
                          AI Polished
                        </span>
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Check className="w-3 h-3" /> Grounded in Git Telemetry
                        </span>
                        <span className="font-mono text-neutral-500">bullet_001</span>
                      </div>
                    </div>
                  </div>

                  {/* Contextual AI Diff Card in landing preview */}
                  <div className="rounded-lg border border-amber-500/30 bg-[#121218] p-3 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" /> Contextual AI Enhancement
                    </div>
                    <div className="text-neutral-400 text-[11px]">
                      <span className="text-neutral-500 font-semibold">Why: </span>
                      Better aligns with target Staff role metrics and quantifies peak throughput under load.
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "latex" && (
                <div className="space-y-3 font-mono text-xs text-neutral-300 bg-[#070709] p-4 rounded-xl border border-white/[0.06]">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
                    Clean Generated LaTeX
                  </div>
                  <div className="text-sky-400">\section&#123;Experience&#125;</div>
                  <div className="pl-4 text-neutral-200">\textbf&#123;Apex Distributed Labs&#125; $|$ \emph&#123;Senior Software Engineer&#125;</div>
                  <div className="pl-4 text-neutral-500">\begin&#123;itemize&#125;[leftmargin=0.15in, label=&#123;$\bullet$&#125;]</div>
                  <div className="pl-8 text-neutral-300">\item Architected distributed caching layer with \textbf&#123;Kafka&#125; and \textbf&#123;Redis&#125;...</div>
                  <div className="pl-4 text-neutral-500">\end&#123;itemize&#125;</div>
                  <div className="pt-2 text-emerald-400 text-[11px]">✓ Compilation ready: 0 errors, 0 warnings</div>
                </div>
              )}

              {activeTab === "jobs" && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Target: Stripe · Distributed Systems</span>
                    <span className="text-amber-400 font-mono font-bold">92% Match</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 flex items-center justify-between">
                      <span className="text-emerald-300 font-medium">✓ Apache Kafka & Event Streams</span>
                      <span className="font-mono text-[10px] text-emerald-400">FOUND</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 flex items-center justify-between">
                      <span className="text-emerald-300 font-medium">✓ Go & Node.js Microservices</span>
                      <span className="font-mono text-[10px] text-emerald-400">FOUND</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 flex items-center justify-between">
                      <span className="text-amber-300 font-medium">◐ Distributed Idempotency</span>
                      <span className="font-mono text-[10px] text-amber-400">PARTIAL</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between text-xs text-neutral-500 border-t border-white/[0.05]">
                <span>No clunky forms. Direct keyboard editing.</span>
                <Link
                  href="/resume/demo/editor"
                  className="text-white hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <span>Open interactive demo</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Right Column: PDF Resume Paper View (5 cols) */}
            <div className="lg:col-span-5 p-6 bg-[#050507] flex items-center justify-center">
              <div className="w-full max-w-[340px] bg-white text-black p-5 rounded-sm shadow-2xl text-[10px] leading-tight select-none">
                <div className="text-center pb-2 border-b border-neutral-300">
                  <div className="font-bold text-xs uppercase text-neutral-900 tracking-wider">
                    Maruthi Kummaragunta
                  </div>
                  <div className="text-[8px] text-neutral-600 font-sans mt-0.5">
                    maruthi.dev@example.com • San Francisco, CA • linkedin.com/in/maruthi-dev
                  </div>
                </div>

                <div className="mt-2.5">
                  <div className="font-bold uppercase tracking-wider text-[9px] border-b border-black pb-0.5 mb-1">
                    Experience
                  </div>
                  <div className="font-semibold text-neutral-900 flex justify-between">
                    <span>Apex Distributed Labs</span>
                    <span className="font-normal text-[8px] text-neutral-600">2024 — Present</span>
                  </div>
                  <div className="italic text-[8px] text-neutral-700">Senior Software Engineer</div>
                  <ul className="list-disc ml-3 space-y-0.5 mt-1 text-[8.5px] text-neutral-800">
                    <li>Architected distributed caching layer with Kafka and Redis, dropping p99 latency to 42ms.</li>
                    <li>Engineered high-concurrency Go microservices delivering 99.99% system availability.</li>
                  </ul>
                </div>

                <div className="mt-2">
                  <div className="font-bold uppercase tracking-wider text-[9px] border-b border-black pb-0.5 mb-1">
                    Technical Skills
                  </div>
                  <div className="text-[8px] text-neutral-800">
                    <strong>Languages:</strong> TypeScript, Go, Python, SQL, LaTeX<br />
                    <strong>Cloud & Infra:</strong> AWS EKS, Kubernetes, Docker, Kafka
                  </div>
                </div>

                <div className="mt-3 pt-1 border-t border-neutral-200 text-center text-[7.5px] text-neutral-400 font-mono">
                  RENDERED VIA LATEXMK · ZERO PARSE LATENCY
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillar Sections */}
      <section id="features" className="py-20 px-6 border-t border-white/[0.06] bg-[#070709]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs uppercase font-mono font-semibold text-amber-400 tracking-widest">
              Engineered Architecture
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              A serious workspace for demanding technical profiles.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-white/[0.08] bg-[#0A0A0E] space-y-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <FileText className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-white">Structured Source of Truth</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Resume data is structured as deterministic JSON with stable element IDs. Never worry about broken formatting or stray whitespace.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/[0.08] bg-[#0A0A0E] space-y-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Code2 className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-white">Direct LaTeX Workspace</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                For when you need pixel-perfect typography. Full syntax highlighting, line numbers, and live pdfLaTeX compilation diagnostics.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/[0.08] bg-[#0A0A0E] space-y-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Briefcase className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-semibold text-white">Traceable JD Semantic Matching</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Not a generic chat interface. Every job requirement is cross-referenced with exact resume evidence links and quantified confidence scores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Templates Showcase */}
      <section id="templates" className="py-20 px-6 border-t border-white/[0.06] bg-[#050505]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-mono font-semibold text-neutral-500 tracking-wider">
                Industry-Tested Layouts
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Designed to pass rigorous technical screens.
              </h3>
            </div>
            <Link href="/resume/new">
              <Button variant="outline" size="sm">
                View all templates
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { name: "Modern Engineer", tag: "FAANG & Startups", ats: "99% ATS Score" },
              { name: "Academic Minimal", tag: "Research & Staff Labs", ats: "98% ATS Score" },
              { name: "Executive Leadership", tag: "Directors & VPs", ats: "96% ATS Score" },
              { name: "Systems / Security Mono", tag: "Kernel & Infra", ats: "97% ATS Score" },
            ].map((t, idx) => (
              <div
                key={idx}
                className="group p-4 rounded-xl border border-white/[0.08] bg-[#09090C] hover:border-white/20 transition-all cursor-pointer space-y-3"
              >
                <div className="aspect-[1/1.2] bg-white rounded-xs p-3 shadow-md flex flex-col justify-between group-hover:scale-[1.02] transition-transform">
                  <div className="space-y-1">
                    <div className="h-1.5 w-1/3 bg-black rounded-xs mx-auto" />
                    <div className="h-0.5 w-1/2 bg-neutral-400 rounded-xs mx-auto" />
                    <div className="h-px bg-neutral-200 my-1" />
                    <div className="h-1 w-1/4 bg-neutral-800 rounded-xs" />
                    <div className="h-0.5 w-full bg-neutral-300 rounded-xs" />
                    <div className="h-0.5 w-5/6 bg-neutral-300 rounded-xs" />
                  </div>
                  <div className="text-[8px] font-mono text-neutral-700 font-bold">{t.ats}</div>
                </div>

                <div>
                  <div className="font-semibold text-white text-xs">{t.name}</div>
                  <div className="text-[11px] text-neutral-500">{t.tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-24 px-6 border-t border-white/[0.06] bg-gradient-to-b from-[#070709] to-[#040405] text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to engineer your next opportunity?
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Create high-signal, deterministic resumes that reflect the precision of your work.
          </p>
          <div className="pt-2">
            <Link href="/resume/demo/editor">
              <Button variant="primary" size="lg" className="px-8 font-semibold">
                <span>Start Building Now</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#050505] px-6 py-8 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center font-mono text-[9px] text-white">
              R
            </div>
            <span className="font-semibold text-neutral-300">Resume Builder</span>
            <span className="text-neutral-700">·</span>
            <span>Precision Engineering Workspace</span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <Link href="/dashboard" className="hover:text-neutral-300 transition-colors">Dashboard</Link>
            <Link href="/resume/demo/editor" className="hover:text-neutral-300 transition-colors">Editor</Link>
            <Link href="/resume/demo/latex" className="hover:text-neutral-300 transition-colors">LaTeX</Link>
            <Link href="/resume/demo/ats" className="hover:text-neutral-300 transition-colors">ATS Analysis</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import React, { useRef } from "react";
import {
  FileText,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Printer,
  Play,
  AlertCircle,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";

interface PDFPreviewProps {
  showToolbar?: boolean;
}

export function PDFPreview({ showToolbar = true }: PDFPreviewProps) {
  const {
    pdfUrl,
    pdfState,
    compileStatus,
    compileLatex,
    isCompiling,
    compileDuration,
    lastCompiledAt,
    compileErrors,
  } = useResume();

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // fallback
      }
    }
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  const handleOpenNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#141519] overflow-hidden select-none">
      {/* ── Toolbar Header ── */}
      {showToolbar && (
        <div className="h-10 border-b border-white/[0.06] bg-[#0E0F12] px-3 flex items-center justify-between text-xs text-neutral-300 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white tracking-wide text-[12px]">
              PDF Preview
            </span>
            {lastCompiledAt && (
              <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
                {compileDuration ? `(${(compileDuration / 1000).toFixed(2)}s)` : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Stale or Compile status */}
            {pdfState === "stale" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-sans">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">PDF out of date</span>
              </span>
            )}
            {pdfState === "failed-with-previous" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-400/20 font-sans">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Compilation failed</span>
              </span>
            )}

            {pdfUrl && (
              <>
                <button
                  onClick={handlePrint}
                  className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                  title="Print PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleOpenNewTab}
                  className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                  title="Open PDF in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Stale Banner ── */}
      {pdfState === "stale" && pdfUrl && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="truncate">
              PDF out of date — this preview was generated from an older version of the project.
            </span>
          </div>
          <button
            onClick={compileLatex}
            disabled={isCompiling}
            className="ml-2 px-2 py-0.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 rounded text-[11px] font-medium border border-amber-400/30 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isCompiling ? "Compiling…" : "Update PDF"}
          </button>
        </div>
      )}
      {pdfState === "failed-with-previous" && pdfUrl && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-rose-300 shrink-0">
          <span className="truncate">Compilation failed — showing last successful PDF.</span>
          <button
            onClick={compileLatex}
            disabled={isCompiling}
            className="ml-2 px-2 py-0.5 bg-rose-400/20 hover:bg-rose-400/30 text-rose-200 rounded text-[11px] font-medium border border-rose-400/30 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isCompiling ? "Compiling…" : "Compile"}
          </button>
        </div>
      )}

      {/* ── Preview Viewport ── */}
      <div className="flex-1 relative bg-[#18191E] flex flex-col items-center justify-center overflow-hidden">
        {isCompiling ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
            <RotateCw className="w-7 h-7 text-amber-400 animate-spin" />
            <p className="text-sm font-medium text-white">Compiling LaTeX Project…</p>
            <p className="text-xs text-neutral-400 max-w-sm">
              Executing pdflatex in an isolated temporary workspace…
            </p>
          </div>
        ) : pdfUrl && pdfState !== "none" ? (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0 bg-white"
            title="Compiled LaTeX PDF Preview"
          />
        ) : compileStatus === "error" ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 max-w-md">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-rose-400">Compilation Failed</p>
            <p className="text-xs text-neutral-400">
              {compileErrors.length > 0
                ? `${compileErrors.length} error(s) detected. Review the errors panel in the editor to jump to problem lines.`
                : "pdflatex exited with an error. Review the compilation log below."}
            </p>
            <button
              onClick={compileLatex}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Compilation</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 max-w-sm">
            <div className="w-10 h-10 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-white">
              {pdfState === "none" ? "No PDF available" : "Ready to Compile"}
            </p>
            <p className="text-xs text-neutral-400">
              {pdfState === "none"
                ? "Compile the project to generate a preview."
                : "Click &quot;Compile PDF&quot; in the toolbar to generate your real document preview using pdflatex."}
            </p>
            <button
              onClick={compileLatex}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 text-xs font-medium transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Compile PDF</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

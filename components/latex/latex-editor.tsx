"use client";

import React, { useState, useCallback } from "react";
import {
  CheckCircle2,
  Terminal,
  Upload,
  Loader2,
  AlertCircle,
  WrapText,
  Columns2,
  Maximize2,
  Save,
  AlertTriangle,
  Play,
  RotateCw,
} from "lucide-react";
import { useResume } from "@/hooks/use-resume";
import { PDFPreview } from "@/components/preview/pdf-preview";
import { LatexCodeEditor } from "@/components/latex/latex-code-editor";

export function LatexWorkspace() {
  const {
    activeFile,
    files,
    entryFileId,
    editorContent,
    onEditorChange,
    fileSaveStatus,
    flushSave,
    uploadStatus,
    uploadFile,
    compileLog,
    compileStatus,
    compileErrors,
    compileDuration,
    lastCompiledAt,
    isPdfStale,
    isCompiling,
    compileLatex,
    activeErrorLine,
    jumpToError,
    editorHighlightRange,
    suggestionFeedback,
  } = useResume();

  const entryFileName =
    files.find((file) => file.id === entryFileId)?.path || "configured entry file";

  const [activeLine, setActiveLine] = useState<number>(1);
  const [activeCol, setActiveCol] = useState<number>(1);
  const [showConsole, setShowConsole] = useState<boolean>(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isWrapLines, setIsWrapLines] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const handleCursorChange = useCallback((line: number, col: number) => {
    setActiveLine(line);
    setActiveCol(col);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".tex")) {
      setUploadError("Only .tex files can be uploaded.");
      setTimeout(() => setUploadError(null), 4000);
      e.target.value = "";
      return;
    }

    setUploadError(null);
    try {
      await uploadFile(file);
    } catch (err) {
      console.error("Editor upload error:", err);
    } finally {
      e.target.value = "";
    }
  };

  // Save status badge styling
  const saveStatusConfig = {
    saved: {
      label: "Saved",
      className: "text-emerald-400",
      Icon: CheckCircle2,
    },
    saving: {
      label: "Saving…",
      className: "text-amber-400",
      Icon: Loader2,
    },
    unsaved: {
      label: "Unsaved",
      className: "text-neutral-400",
      Icon: Save,
    },
    error: {
      label: "Save failed",
      className: "text-rose-400",
      Icon: AlertTriangle,
    },
  } as const;

  const saveInfo = saveStatusConfig[fileSaveStatus];

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] flex flex-col bg-[#070709] select-none">
      {suggestionFeedback && (
        <div
          className={`px-3 py-1.5 text-[11px] border-b ${
            suggestionFeedback.type === "success"
              ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
              : "text-rose-300 bg-rose-500/10 border-rose-500/20"
          }`}
          role="status"
        >
          {suggestionFeedback.type === "success" ? "✓ " : ""}
          {suggestionFeedback.message}
        </div>
      )}
      {/* Main 2-Way Split: CodeMirror 6 Editor + PDF Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center: Monospace CodeMirror 6 Editor */}
        <div className="flex-1 flex flex-col bg-[#070709] border-r border-white/[0.08] min-w-0 overflow-hidden">
          {/* Editor Header Bar */}
          <div className="h-9 border-b border-white/[0.06] px-3 bg-[#0B0B0E] flex items-center justify-between text-[11px] text-neutral-400 font-mono shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white font-medium truncate max-w-[180px]">
                {activeFile?.name || "No file open"}
              </span>
              {activeFile?.isUploaded && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-mono border border-emerald-500/30 shrink-0">
                  Uploaded
                </span>
              )}

              {/* Real Compile PDF Button */}
              <button
                type="button"
                onClick={compileLatex}
                disabled={isCompiling}
                className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-sans font-medium transition-colors shrink-0 disabled:opacity-60 ${
                  isCompiling
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    : compileStatus === "error"
                    ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40"
                    : isPdfStale
                    ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40"
                }`}
                title={
                  isPdfStale
                    ? "Changes since last compile — click to recompile"
                    : "Compile LaTeX with pdflatex (⌘+Enter / Ctrl+Enter)"
                }
              >
                {isCompiling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : compileStatus === "error" ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>
                  {isCompiling
                    ? "Compiling…"
                    : compileStatus === "error"
                    ? "Compile Failed"
                    : isPdfStale
                    ? "Recompile PDF"
                    : "Compile PDF"}
                </span>
              </button>

              {/* Stale PDF indicator badge */}
              {isPdfStale && (
                <span className="hidden xl:inline-flex items-center gap-1 text-[10px] text-amber-400/90 font-sans bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                  <AlertTriangle className="w-3 h-3" /> Changes since last compile
                </span>
              )}

              {/* Upload trigger */}
              <label
                className={`cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans transition-colors shrink-0 ${
                  uploadStatus === "uploading"
                    ? "bg-amber-400/10 text-amber-300 border border-amber-400/20 opacity-70"
                    : "bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 hover:text-white border border-white/[0.08]"
                }`}
                title="Upload .tex file from disk"
              >
                {uploadStatus === "uploading" ? (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                ) : (
                  <Upload className="w-3 h-3 text-amber-400" />
                )}
                <span className="hidden sm:inline">
                  {uploadStatus === "uploading" ? "Uploading..." : "Upload"}
                </span>
                <input
                  type="file"
                  accept=".tex"
                  className="hidden"
                  disabled={uploadStatus === "uploading"}
                  onChange={handleFileUpload}
                />
              </label>

              {/* Error badge */}
              {uploadError && (
                <span className="text-rose-400 text-[10px] font-sans flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {uploadError}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-neutral-400 shrink-0">
              {/* Save status indicator */}
              <span
                className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-sans ${saveInfo.className}`}
                title={
                  fileSaveStatus === "error"
                    ? "Save failed — check backend connection"
                    : undefined
                }
              >
                <saveInfo.Icon
                  className={`w-3 h-3 ${fileSaveStatus === "saving" ? "animate-spin" : ""}`}
                />
                {saveInfo.label}
              </span>

              <div className="h-3 w-px bg-white/10 hidden sm:inline" />
              <span className="hidden sm:inline">
                Ln {activeLine}, Col {activeCol}
              </span>
              <div className="h-3 w-px bg-white/10 hidden sm:inline" />

              {/* Toggle Line Wrap */}
              <button
                type="button"
                onClick={() => setIsWrapLines((prev) => !prev)}
                className={`p-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                  isWrapLines
                    ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                    : "hover:bg-white/[0.08] hover:text-white text-neutral-400"
                }`}
                title={isWrapLines ? "Disable word wrap" : "Enable word wrap"}
              >
                <WrapText className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden md:inline font-sans">
                  {isWrapLines ? "Wrapped" : "Wrap"}
                </span>
              </button>

              {/* Toggle Maximize Editor */}
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                className={`p-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                  isMaximized
                    ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                    : "hover:bg-white/[0.08] hover:text-white text-neutral-400"
                }`}
                title={
                  isMaximized
                    ? "Restore split view with PDF preview"
                    : "Maximize code editor panel"
                }
              >
                {isMaximized ? (
                  <Columns2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                <span className="text-[10px] hidden md:inline font-sans">
                  {isMaximized ? "Split" : "Full Code"}
                </span>
              </button>
            </div>
          </div>

          {/* Real CodeMirror 6 LaTeX Editor */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-[#070709] relative select-text">
            {activeFile ? (
              <LatexCodeEditor
                value={editorContent}
                onChange={onEditorChange}
                fileId={activeFile.id}
                isWrapLines={isWrapLines}
                onCursorChange={handleCursorChange}
                onSave={flushSave}
                targetLine={activeErrorLine}
                highlightRange={editorHighlightRange}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                <p className="text-sm font-medium text-neutral-400">No file open</p>
                <p className="text-xs text-neutral-600 mt-1 max-w-xs">
                  Select a file from the Project Files sidebar or click + to create a new file
                </p>
              </div>
            )}
          </div>

          {/* ── Compilation Errors Panel (When errors exist) ── */}
          {compileErrors.length > 0 && (
            <div className="border-t border-rose-500/30 bg-[#140b0e] px-3 py-2 text-xs font-mono shrink-0 max-h-36 overflow-y-auto space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-sans text-rose-400">
                <span className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Compilation Errors ({compileErrors.length})
                </span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  Click error to jump to source
                </span>
              </div>
              <div className="space-y-1">
                {compileErrors.map((err, idx) => (
                  <button
                    key={idx}
                    onClick={() => jumpToError(err)}
                    className="w-full text-left p-1.5 rounded bg-black/40 hover:bg-rose-950/50 border border-rose-500/20 hover:border-rose-500/40 transition-colors flex items-start gap-2 cursor-pointer group"
                  >
                    <span className="text-rose-400 font-bold shrink-0">✕</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-rose-300 font-semibold group-hover:underline">
                        {err.file || entryFileName}{err.line ? `:${err.line}` : ""}
                      </span>
                      <span className="text-neutral-300 ml-2 text-[11px]">
                        {err.message}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Console / Diagnostics Drawer */}
          {showConsole && (
            <div className="h-32 border-t border-white/[0.08] bg-[#09090C] flex flex-col font-mono text-xs shrink-0">
              <div className="h-7 border-b border-white/[0.06] px-3 flex items-center justify-between text-[11px] bg-[#0C0C0E]">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="font-semibold text-neutral-300">
                    Compile Diagnostics
                  </span>
                  <span className="text-neutral-600">|</span>
                  {compileStatus === "success" ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Zero errors
                    </span>
                  ) : compileStatus === "error" ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Compilation failed
                    </span>
                  ) : (
                    <span className="text-neutral-400">Ready</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-neutral-500">
                  {compileDuration && (
                    <span>{(compileDuration / 1000).toFixed(2)}s compile</span>
                  )}
                  <button
                    onClick={() => setShowConsole(false)}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex-1 p-3 text-[11px] text-neutral-400 overflow-y-auto space-y-1 font-mono select-text">
                <div className="text-neutral-500">
                  {">"} pdflatex -interaction=nonstopmode -halt-on-error -file-line-error {entryFileName}
                </div>
                <pre className="text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {compileLog}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right: PDF Preview (hidden when editor is maximized) */}
        {!isMaximized && (
          <div className="w-[48%] shrink-0 hidden lg:block border-l border-white/[0.06]">
            <PDFPreview />
          </div>
        )}
      </div>
    </div>
  );
}

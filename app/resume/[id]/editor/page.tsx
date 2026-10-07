"use client";

import React, { useState } from "react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { StructurePanel } from "@/components/editor/structure-panel";
import { BlockEditor } from "@/components/editor/block-editor";
import { PDFPreview } from "@/components/preview/pdf-preview";
import { Layers, FileText, Eye } from "lucide-react";

export default function ResumeEditorPage() {
  const [mobileTab, setMobileTab] = useState<"structure" | "editor" | "preview">("editor");

  return (
    <WorkspaceShell>
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Mobile/Tablet Adaptive Tabs Header (< 1024px) */}
        <div className="lg:hidden flex items-center justify-around border-b border-white/[0.08] bg-[#0A0A0C] p-2 text-xs">
          <button
            onClick={() => setMobileTab("structure")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
              mobileTab === "structure"
                ? "bg-white/10 text-white font-medium"
                : "text-neutral-500"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Structure</span>
          </button>

          <button
            onClick={() => setMobileTab("editor")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
              mobileTab === "editor"
                ? "bg-white/10 text-white font-medium"
                : "text-neutral-500"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>

          <button
            onClick={() => setMobileTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
              mobileTab === "preview"
                ? "bg-white/10 text-white font-medium"
                : "text-neutral-500"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>PDF Preview</span>
          </button>
        </div>

        {/* Main 3-Pane Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Structure Navigator */}
          <div
            className={`w-56 shrink-0 h-full ${
              mobileTab === "structure" ? "block w-full" : "hidden lg:block"
            }`}
          >
            <StructurePanel />
          </div>

          {/* Middle Pane: Inline Block Editor */}
          <div
            className={`flex-1 h-full min-w-0 ${
              mobileTab === "editor" ? "block w-full" : "hidden lg:block"
            }`}
          >
            <BlockEditor />
          </div>

          {/* Right Pane: High-Fidelity PDF Preview */}
          <div
            className={`w-[45%] shrink-0 h-full ${
              mobileTab === "preview" ? "block w-full" : "hidden xl:block"
            }`}
          >
            <PDFPreview />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

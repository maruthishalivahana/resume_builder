"use client";

import React from "react";
import { ResumeSidebar } from "@/components/app-shell/resume-sidebar";
import { AppHeader } from "@/components/app-shell/app-header";
import { ResumeAIFloating } from "@/components/ai/resume-ai-floating";
import { ShortcutsModal } from "@/components/app-shell/shortcuts-modal";
import { useResume } from "@/hooks/use-resume";
import { CompileTargetDialog } from "@/components/latex/compile-target-dialog";

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const { requestedProjectId, projectId, isProjectLoading, projectLoadError, loadProject } = useResume();
  const retryProjectId = requestedProjectId === "demo" ? projectId : requestedProjectId;
  const waitingForProject = requestedProjectId && requestedProjectId !== "demo" && requestedProjectId !== projectId;
  if (isProjectLoading || projectLoadError || waitingForProject) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#050505] text-neutral-200 p-6">
        <p role={projectLoadError ? "alert" : "status"}>{projectLoadError ?? "Loading project…"}</p>
        {projectLoadError && retryProjectId && (
          <button className="underline" onClick={() => { void loadProject(retryProjectId).catch(() => {}); }}>Retry project load</button>
        )}
      </div>
    );
  }
  return (
    <div className="h-screen w-screen flex bg-[#050505] text-[#EDEDED] overflow-hidden select-none">
      {/* Persistent Collapsible Left Sidebar */}
      <ResumeSidebar />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Minimal Quiet Top Header */}
        <AppHeader />

        {/* Workspace Canvas / Body */}
        <main className="flex-1 flex overflow-hidden relative">
          {children}
        </main>

        {/* Global Contextual AI Copilot Drawer */}
        <ResumeAIFloating />

        {/* Keyboard Shortcuts Modal */}
        <ShortcutsModal />
        <CompileTargetDialog />
      </div>
    </div>
  );
}

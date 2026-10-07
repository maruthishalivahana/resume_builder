"use client";

import React from "react";
import { ResumeSidebar } from "@/components/app-shell/resume-sidebar";
import { AppHeader } from "@/components/app-shell/app-header";
import { AIDrawer } from "@/components/ai/ai-drawer";
import { ShortcutsModal } from "@/components/app-shell/shortcuts-modal";

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
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
        <AIDrawer />

        {/* Keyboard Shortcuts Modal */}
        <ShortcutsModal />
      </div>
    </div>
  );
}

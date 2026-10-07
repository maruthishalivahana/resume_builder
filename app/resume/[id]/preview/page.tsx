"use client";

import React from "react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { PDFPreview } from "@/components/preview/pdf-preview";

export default function ResumePreviewPage() {
  return (
    <WorkspaceShell>
      <div className="w-full h-full flex flex-col overflow-hidden">
        <PDFPreview />
      </div>
    </WorkspaceShell>
  );
}

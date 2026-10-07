"use client";

import React from "react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { LatexWorkspace } from "@/components/latex/latex-editor";

export default function ResumeLatexPage() {
  return (
    <WorkspaceShell>
      <LatexWorkspace />
    </WorkspaceShell>
  );
}

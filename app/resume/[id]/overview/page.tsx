"use client";

import React from "react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { ResumeOverview } from "@/components/dashboard/resume-overview";

export default function ResumeOverviewPage() {
  return (
    <WorkspaceShell>
      <ResumeOverview />
    </WorkspaceShell>
  );
}

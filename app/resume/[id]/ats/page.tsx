"use client";

import React from "react";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import { ATSOverview } from "@/components/ats/ats-overview";

export default function ResumeATSPage() {
  return (
    <WorkspaceShell>
      <ATSOverview />
    </WorkspaceShell>
  );
}

"use client";

import React from "react";
import { Navbar } from "@/components/layout/navbar";
import { JobMatcher } from "@/components/jobs/job-matcher";

export default function JobDetailPage() {
  return (
    <div className="h-screen flex flex-col bg-[#050505] text-[#EDEDED] overflow-hidden">
      <Navbar />
      <JobMatcher />
    </div>
  );
}

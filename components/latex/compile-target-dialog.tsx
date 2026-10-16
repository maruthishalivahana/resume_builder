"use client";

import { useEffect, useRef } from "react";
import { useResume } from "@/hooks/use-resume";

export function CompileTargetDialog() {
  const { compileTargetChoice, resolveCompileTarget } = useResume();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (compileTargetChoice) dialog.current?.showModal();
    else dialog.current?.close();
  }, [compileTargetChoice]);
  return (
    <dialog ref={dialog} aria-labelledby="compile-target-title"
      onCancel={() => resolveCompileTarget("cancel")}
      className="rounded-xl border border-white/20 bg-[#121216] text-neutral-200 p-6 max-w-lg backdrop:bg-black/75">
      {compileTargetChoice && <>
        <h2 id="compile-target-title" className="font-semibold mb-3">Choose the file to compile</h2>
        <p className="mb-4 break-all">You are editing {compileTargetChoice.openPath}. The selected target is {compileTargetChoice.entryPath}.</p>
        <div className="flex flex-col gap-3 items-start">
          <button autoFocus className="underline" onClick={() => resolveCompileTarget("configured")}>Compile selected target</button>
          <button className="underline" onClick={() => resolveCompileTarget("open")}>Compile open file without changing default</button>
          <button className="underline" onClick={() => resolveCompileTarget("cancel")}>Cancel</button>
        </div>
      </>}
    </dialog>
  );
}

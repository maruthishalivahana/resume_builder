import { LatexFile, ILatexFile } from "../models/LatexFile";
import TailoringSuggestion from "../modules/job-tailoring/models/TailoringSuggestion";
import ResumeEvidence from "../modules/job-tailoring/models/ResumeEvidence";
import { bumpProjectSourceVersion } from "./latexProjectState.service";
import { LatexProject } from "../models/LatexProject";

/** Standalone-Mongo-compatible journal. The marker is committed with file content.
 * Repeated finalization may bump sourceVersion again; monotonic invalidation is safe.
 * New writes/compiles must reject a marker until finalization succeeds.
 */
export async function finalizeFileWrite(file: ILatexFile): Promise<boolean> {
  const pending = file.pendingWrite;
  if (!pending) return true;
  try {
    if (pending.suggestionId) {
      const applied = await TailoringSuggestion.findOneAndUpdate(
        { suggestionId: pending.suggestionId, projectId: file.projectId.toString() },
        { $set: { status: "accepted", appliedAt: new Date(), appliedFileId: file._id.toString(),
          appliedLineStart: pending.lineStart, appliedLineEnd: pending.lineEnd,
          appliedBeforeHash: pending.beforeHash, appliedAfterHash: pending.afterHash } }, { new: true });
      if (!applied) return false;
      await ResumeEvidence.deleteOne({ evidenceId: pending.evidenceId, projectId: file.projectId.toString(), versionId: pending.versionId });
    }
    await bumpProjectSourceVersion(file.projectId);
    await LatexFile.updateOne({ _id: file._id, contentRevision: file.contentRevision, pendingWrite: { $exists: true } }, { $unset: { pendingWrite: 1 } });
    return true;
  } catch (error) {
    console.error("File write committed; metadata recovery pending", file._id.toString(), error instanceof Error ? error.message : "Recovery failed");
    return false;
  }
}

/** Keep the file recoverable until deletion metadata is finalized; delete last. */
export async function finalizeFileDeletion(file: ILatexFile): Promise<boolean> {
  try {
    await LatexProject.updateOne({ _id: file.projectId, entryFileId: file._id },
      { $set: { entryFileId: null, entryFileSelectionRequired: true } });
    await bumpProjectSourceVersion(file.projectId);
    await LatexFile.findOneAndDelete({ _id: file._id, pendingDelete: true });
    return true;
  } catch { return false; }
}

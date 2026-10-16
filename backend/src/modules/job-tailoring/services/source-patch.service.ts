import { AppError } from "../../../middleware/error.middleware";
import { LatexFile } from "../../../models/LatexFile";
import ResumeEvidence from "../models/ResumeEvidence";
import TailoringSuggestion from "../models/TailoringSuggestion";
import { SourcePatch } from "../types";
import { hashSourceText } from "../utils/source-hash.util";
import { finalizeFileWrite } from "../../../services/latexWriteRecovery.service";
import { sourceLineRange } from "../utils/source-range.util";

export class SourcePatchService {
  private static readonly activeSuggestions = new Set<string>();

  async apply(input: {
    suggestionId: string;
    projectId: string;
    versionId: string;
  }): Promise<{
    suggestionId: string;
    status: "accepted";
    fileId: string;
    fileName: string;
    changedLineStart: number;
    changedLineEnd: number;
    updatedContent: string;
    contentRevision: number;
    recoveryPending: boolean;
    pdfStale: true;
  }> {
    if (SourcePatchService.activeSuggestions.has(input.suggestionId)) {
      throw new AppError("Suggestion has already been applied", 409, "SUGGESTION_ALREADY_APPLIED");
    }
    SourcePatchService.activeSuggestions.add(input.suggestionId);
    try {
      return await this.applyInternal(input);
    } finally {
      SourcePatchService.activeSuggestions.delete(input.suggestionId);
    }
  }

  private async applyInternal(input: {
    suggestionId: string;
    projectId: string;
    versionId: string;
  }): Promise<{
    suggestionId: string;
    status: "accepted";
    fileId: string;
    fileName: string;
    changedLineStart: number;
    changedLineEnd: number;
    updatedContent: string;
    contentRevision: number;
    recoveryPending: boolean;
    pdfStale: true;
  }> {
    const suggestion = await TailoringSuggestion.findOne({ suggestionId: input.suggestionId }).lean();
    if (!suggestion) throw new AppError("Suggestion not found", 404, "SUGGESTION_NOT_FOUND");
    if (suggestion.projectId !== input.projectId) throw new AppError("Suggestion belongs to another project", 403, "PROJECT_MISMATCH");
    if (suggestion.versionId !== input.versionId) throw new AppError("Suggestion belongs to another resume version", 409, "VERSION_MISMATCH");
    if (suggestion.validation !== "PASS") throw new AppError("Suggestion failed claim validation", 422, "VALIDATION_FAILED");
    const patch = suggestion.sourcePatch;
    if (!patch) throw new AppError("Suggestion has no source patch", 422, "SOURCE_NOT_FOUND");
    const file = await LatexFile.findOne({ _id: patch.fileId, projectId: input.projectId });
    if (!file) throw new AppError("Source file was not found", 404, "FILE_NOT_FOUND");
    if (file.pendingDelete) throw new AppError("Source file deletion is pending", 409, "DELETE_RECOVERY_PENDING");
    // A retry after commit finishes the durable journal, never reapplies the patch.
    if (suggestion.status === "accepted" || file.pendingWrite?.suggestionId === input.suggestionId) {
      const recoveryPending = !await finalizeFileWrite(file);
      return { suggestionId: input.suggestionId, status: "accepted", fileId: patch.fileId, fileName: patch.fileName,
        changedLineStart: suggestion.appliedLineStart ?? file.pendingWrite?.lineStart ?? patch.lineStart,
        changedLineEnd: suggestion.appliedLineEnd ?? file.pendingWrite?.lineEnd ?? patch.lineEnd,
        updatedContent: file.content, contentRevision: file.contentRevision ?? 0, recoveryPending, pdfStale: true };
    }
    if (suggestion.status !== "pending") throw new AppError("Only pending suggestions can be applied", 409, "SUGGESTION_NOT_PENDING");
    if (file.pendingWrite && !await finalizeFileWrite(file)) throw new AppError("Previous write recovery is pending", 503, "WRITE_RECOVERY_PENDING");

    const evidence = await ResumeEvidence.findOne({
      evidenceId: patch.evidenceId,
      projectId: input.projectId,
      versionId: input.versionId,
    }).lean();
    if (!evidence) throw new AppError("Source evidence was not found", 404, "EVIDENCE_NOT_FOUND");
    if (evidence.source.fileId !== patch.fileId || evidence.source.fileName !== patch.fileName) {
      throw new AppError("Suggestion source file does not match evidence", 409, "SOURCE_CHANGED");
    }
    const patchResult = applySourcePatchContent(file.content, patch);
    const location = patchResult.location;
    const updatedContent = patchResult.updatedContent;
    const updated = await LatexFile.findOneAndUpdate(
      { _id: file._id, projectId: input.projectId, pendingWrite: { $exists: false }, pendingDelete: { $ne: true }, content: file.content,
        ...((file.contentRevision ?? 0) === 0 ? { $or: [{ contentRevision: 0 }, { contentRevision: { $exists: false } }] } : { contentRevision: file.contentRevision }) },
      { $set: { content: updatedContent, pendingWrite: { suggestionId: input.suggestionId,
        evidenceId: patch.evidenceId, versionId: input.versionId, lineStart: location.lineStart,
        lineEnd: location.lineStart + patch.after.split(/\r?\n/).length - 1,
        beforeHash: patch.beforeHash, afterHash: hashSourceText(patch.after) } }, $inc: { contentRevision: 1 } },
      { new: true }
    );
    if (!updated) {
      const latestSuggestion = await TailoringSuggestion.findOne({ suggestionId: input.suggestionId }).select({ status: 1 }).lean();
      if (latestSuggestion?.status === "accepted") {
        throw new AppError("Suggestion has already been applied", 409, "SUGGESTION_ALREADY_APPLIED");
      }
      throw new AppError("The source changed while applying the suggestion", 409, "SOURCE_CHANGED");
    }
    const recoveryPending = !await finalizeFileWrite(updated);
    return {
      suggestionId: input.suggestionId,
      status: "accepted",
      fileId: patch.fileId,
      fileName: patch.fileName,
      changedLineStart: location.lineStart,
      changedLineEnd: location.lineStart + patch.after.split(/\r?\n/).length - 1,
      updatedContent,
      contentRevision: updated.contentRevision,
      recoveryPending,
      pdfStale: true,
    };
  }
}

interface Location { startOffset: number; endOffset: number; lineStart: number; lineEnd: number }

export function applySourcePatchContent(content: string, patch: SourcePatch): { updatedContent: string; location: Location } {
  if (!patch.before || hashSourceText(patch.before) !== patch.beforeHash) {
    throw new AppError("The source patch text or hash is invalid", 409, "SOURCE_CHANGED");
  }
  let location: Location | null = null;
  const range = sourceLineRange(content, patch.lineStart, patch.lineEnd);
  if (range?.text === patch.before) {
    location = { startOffset: range.startOffset, endOffset: range.endOffset, lineStart: patch.lineStart, lineEnd: patch.lineEnd };
  }
  if (!location) {
    const matches = findOccurrences(content, patch.before);
    if (matches.length === 0) throw new AppError("The resume content changed and the source text was not found", 409, "SOURCE_CHANGED");
    if (matches.length > 1) throw new AppError("The source text occurs multiple times and cannot be relocated safely", 409, "AMBIGUOUS_SOURCE");
    location = rangeFromOffset(content, matches[0], patch.before);
  }
  return {
    updatedContent: replaceRange(content, location.startOffset, location.endOffset, patch.after),
    location,
  };
}

function findOccurrences(content: string, expected: string): number[] {
  const matches: number[] = [];
  let offset = content.indexOf(expected);
  while (offset !== -1) {
    matches.push(offset);
    offset = content.indexOf(expected, offset + expected.length);
  }
  return matches;
}

function rangeFromOffset(content: string, offset: number, text: string): Location {
  const before = content.slice(0, offset);
  const lineStart = before.split(/\r?\n/).length;
  const lineEnd = lineStart + text.split(/\r?\n/).length - 1;
  return { startOffset: offset, endOffset: offset + text.length, lineStart, lineEnd };
}

function replaceRange(content: string, startOffset: number, endOffset: number, replacement: string): string {
  return `${content.slice(0, startOffset)}${replacement}${content.slice(endOffset)}`;
}

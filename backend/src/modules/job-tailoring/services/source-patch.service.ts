import { AppError } from "../../../middleware/error.middleware";
import { LatexFile } from "../../../models/LatexFile";
import ResumeEvidence from "../models/ResumeEvidence";
import TailoringSuggestion from "../models/TailoringSuggestion";
import { SourcePatch } from "../types";
import { hashSourceText } from "../utils/source-hash.util";
import { bumpProjectSourceVersion } from "../../../services/latexProjectState.service";

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
    pdfStale: true;
  }> {
    const suggestion = await TailoringSuggestion.findOne({ suggestionId: input.suggestionId }).lean();
    if (!suggestion) throw new AppError("Suggestion not found", 404, "SUGGESTION_NOT_FOUND");
    if (suggestion.projectId !== input.projectId) throw new AppError("Suggestion belongs to another project", 403, "PROJECT_MISMATCH");
    if (suggestion.versionId !== input.versionId) throw new AppError("Suggestion belongs to another resume version", 409, "VERSION_MISMATCH");
    if (suggestion.validation !== "PASS") throw new AppError("Suggestion failed claim validation", 422, "VALIDATION_FAILED");
    if (suggestion.status === "accepted") throw new AppError("Suggestion has already been applied", 409, "SUGGESTION_ALREADY_APPLIED");
    if (suggestion.status !== "pending") throw new AppError("Only pending suggestions can be applied", 409, "SUGGESTION_NOT_PENDING");
    const patch = suggestion.sourcePatch;
    if (!patch) throw new AppError("Suggestion has no source patch", 422, "SOURCE_NOT_FOUND");

    const evidence = await ResumeEvidence.findOne({
      evidenceId: patch.evidenceId,
      projectId: input.projectId,
      versionId: input.versionId,
    }).lean();
    if (!evidence) throw new AppError("Source evidence was not found", 404, "EVIDENCE_NOT_FOUND");
    if (evidence.source.fileId !== patch.fileId || evidence.source.fileName !== patch.fileName) {
      throw new AppError("Suggestion source file does not match evidence", 409, "SOURCE_CHANGED");
    }
    const file = await LatexFile.findOne({ _id: patch.fileId, projectId: input.projectId });
    if (!file) throw new AppError("Source file was not found", 404, "FILE_NOT_FOUND");
    const patchResult = applySourcePatchContent(file.content, patch);
    const location = patchResult.location;
    const updatedContent = patchResult.updatedContent;
    const updated = await LatexFile.findOneAndUpdate(
      { _id: file._id, projectId: input.projectId, content: file.content },
      { $set: { content: updatedContent } },
      { new: true }
    );
    if (!updated) {
      const latestSuggestion = await TailoringSuggestion.findOne({ suggestionId: input.suggestionId }).select({ status: 1 }).lean();
      if (latestSuggestion?.status === "accepted") {
        throw new AppError("Suggestion has already been applied", 409, "SUGGESTION_ALREADY_APPLIED");
      }
      throw new AppError("The source changed while applying the suggestion", 409, "SOURCE_CHANGED");
    }
    const applied = await TailoringSuggestion.findOneAndUpdate(
      { suggestionId: input.suggestionId, status: "pending" },
      {
        $set: {
          status: "accepted",
          appliedAt: new Date(),
          appliedFileId: patch.fileId,
          appliedLineStart: location.lineStart,
          appliedLineEnd: location.lineStart + patch.after.split(/\r?\n/).length - 1,
          appliedBeforeHash: patch.beforeHash,
          appliedAfterHash: hashSourceText(patch.after),
        },
      },
      { new: true }
    );
    if (!applied) throw new AppError("Suggestion has already been applied", 409, "SUGGESTION_ALREADY_APPLIED");
    await ResumeEvidence.deleteOne({ evidenceId: patch.evidenceId, projectId: input.projectId, versionId: input.versionId });
    await bumpProjectSourceVersion(input.projectId);
    return {
      suggestionId: input.suggestionId,
      status: "accepted",
      fileId: patch.fileId,
      fileName: patch.fileName,
      changedLineStart: location.lineStart,
      changedLineEnd: location.lineStart + patch.after.split(/\r?\n/).length - 1,
      updatedContent,
      pdfStale: true,
    };
  }
}

interface Location { startOffset: number; endOffset: number; lineStart: number; lineEnd: number }

export function applySourcePatchContent(content: string, patch: SourcePatch): { updatedContent: string; location: Location } {
  const lines = content.split(/\r?\n/);
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") offsets.push(index + 1);
  }
  let location: Location | null = null;
  if (patch.lineStart >= 1 && patch.lineEnd >= patch.lineStart && patch.lineEnd <= lines.length) {
    const startOffset = offsets[patch.lineStart - 1];
    const endOffset = patch.lineEnd === lines.length ? content.length : offsets[patch.lineEnd] - newline.length;
    const selected = content.slice(startOffset, endOffset);
    if (selected === patch.before && hashSourceText(selected) === patch.beforeHash) {
      location = { startOffset, endOffset, lineStart: patch.lineStart, lineEnd: patch.lineEnd };
    }
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

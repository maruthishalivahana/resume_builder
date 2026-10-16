import { AppError } from "../../../middleware/error.middleware";
import { ResumeEvidenceData, SourcePatch } from "../types";
import { hashSourceText } from "./source-hash.util";

export function sourceLineRange(content: string, lineStart: number, lineEnd: number): { text: string; startOffset: number; endOffset: number } | null {
  const starts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") starts.push(index + 1);
  }
  if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd) || lineStart < 1 || lineEnd < lineStart || lineEnd > starts.length) return null;
  const startOffset = starts[lineStart - 1];
  let endOffset = lineEnd === starts.length ? content.length : starts[lineEnd] - 1;
  if (lineEnd < starts.length && content[endOffset - 1] === "\r") endOffset -= 1;
  return { text: content.slice(startOffset, endOffset), startOffset, endOffset };
}

export function createEvidenceSourcePatch(
  content: string,
  evidence: Pick<ResumeEvidenceData, "id" | "rawText" | "source">,
  generated: { before: string; after: string }
): SourcePatch {
  if (typeof evidence.rawText !== "string" || !evidence.rawText) {
    throw new AppError("Evidence has no exact source text; re-index the resume before generating suggestions", 422, "SOURCE_NOT_FOUND");
  }
  const range = sourceLineRange(content, evidence.source.lineStart, evidence.source.lineEnd);
  if (!range || range.text !== evidence.rawText) {
    throw new AppError("The evidence source changed; re-index the resume before generating suggestions", 409, "SOURCE_CHANGED");
  }
  if (!generated.before || typeof generated.after !== "string") {
    throw new AppError("Suggestion text could not be mapped to the exact source", 422, "SOURCE_NOT_FOUND");
  }
  const first = range.text.indexOf(generated.before);
  if (first < 0) throw new AppError("Suggestion text could not be mapped to the exact source", 422, "SOURCE_NOT_FOUND");
  if (range.text.indexOf(generated.before, first + 1) >= 0) {
    throw new AppError("Suggestion text is ambiguous within the source range", 422, "AMBIGUOUS_SOURCE");
  }
  const endings = range.text.match(/\r?\n/g) ?? [];
  const newline = endings[0] ?? content.match(/\r?\n/)?.[0] ?? "\n";
  // A mixed-ending source has no single convention. Require explicit preservation.
  if (new Set(endings).size > 1 && JSON.stringify(generated.after.match(/\r?\n/g) ?? []) !== JSON.stringify(endings)) {
    throw new AppError("Suggestion must preserve the mixed line endings of its source range", 422, "SOURCE_NOT_FOUND");
  }
  const replacement = new Set(endings).size > 1 ? generated.after : generated.after.replace(/\r?\n/g, () => newline);
  const after = range.text.slice(0, first) + replacement + range.text.slice(first + generated.before.length);
  return {
    fileId: evidence.source.fileId, fileName: evidence.source.fileName, evidenceId: evidence.id,
    lineStart: evidence.source.lineStart, lineEnd: evidence.source.lineEnd,
    before: range.text, after, beforeHash: hashSourceText(range.text),
  };
}

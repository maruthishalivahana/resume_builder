import { GenerationProposal } from "../providers/interfaces";
import { GroundedSuggestion, RankedEvidence } from "../types";

// Only literal text outside arguments, comments, options and math is eligible.
// Unknown macro arguments are deliberately opaque; this is not a LaTeX parser.
function isLiteralSpan(source: string, start: number, end: number): boolean {
  if (/\\(?:verb\b|catcode\b|begin\{(?:verbatim|lstlisting|minted)\})/.test(source)) return false;
  let depth = 0;
  let optionDepth = 0;
  let math = false;
  let comment = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "\n" || char === "\r") comment = false;
    if (i >= start && i < end && (depth || optionDepth || math || comment || /[\\{}\[\]$%#&_~^]/.test(char))) return false;
    if (comment) continue;
    if (char === "%") { comment = true; continue; }
    if (char === "\\") {
      const command = source.slice(i).match(/^\\(?:[a-zA-Z]+\*?|.)/);
      const next = i + (command?.[0].length ?? 1);
      if (command && !/^\\(?:item|textbf|textit|emph|texttt|label|section|subsection|begin|end|href|url)$/.test(command[0])) return false;
      if (i < end && next > start) return false;
      if (command?.[0] === "\\(" || command?.[0] === "\\[" || command?.[0] === "\\)" || command?.[0] === "\\]") math = !math;
      i = next - 1;
      continue;
    }
    if (char === "$") math = !math;
    if (char === "{") depth++;
    if (char === "}") { if (!depth) return false; depth--; }
    if (char === "[") optionDepth++;
    if (char === "]") { if (!optionDepth) return false; optionDepth--; }
  }
  return depth === 0 && optionDepth === 0 && !math;
}

export function resolveHighlight(proposal: GenerationProposal, evidence: RankedEvidence[]): GroundedSuggestion | null {
  if (proposal.type !== "highlight") return proposal as GroundedSuggestion;
  const targets = evidence.filter(item => item.id === proposal.targetEvidenceId);
  if (targets.length !== 1 || typeof targets[0].rawText !== "string") return null;
  const raw = targets[0].rawText;
  let span: string;
  if ("highlightText" in proposal) {
    span = proposal.highlightText;
  } else {
    // Compatibility with old providers: accept only one exact bold insertion.
    if (typeof proposal.before !== "string" || typeof proposal.after !== "string") return null;
    const candidates = [...proposal.after.matchAll(/\\textbf\{([^{}\\]+)\}/g)].filter(match =>
      proposal.after.slice(0, match.index) + match[1] + proposal.after.slice(match.index! + match[0].length) === proposal.before);
    if (candidates.length !== 1 || raw.indexOf(proposal.before) < 0 || raw.indexOf(proposal.before) !== raw.lastIndexOf(proposal.before)) return null;
    span = candidates[0][1];
  }
  if (typeof span !== "string" || !span.trim() || span !== span.trim()) return null;
  const start = raw.indexOf(span);
  if (start < 0 || raw.indexOf(span, start + 1) >= 0 || !isLiteralSpan(raw, start, start + span.length)) return null;
  return { type: "highlight", targetEvidenceId: proposal.targetEvidenceId, before: raw,
    after: raw.slice(0, start) + `\\textbf{${span}}` + raw.slice(start + span.length),
    reason: proposal.reason, evidenceIds: proposal.evidenceIds, confidence: proposal.confidence };
}

import { HighlightProposal, LLMProvider } from "../providers/interfaces";
import { resolveHighlight } from "./highlight-edit.service";
import { evidenceTerms, isSubstantiveEvidenceTerm, normalizeEvidenceText } from "../utils/evidence-terms.util";
import { explicitlyNegatesRequirement } from "../utils/evidence-negation.util";

export interface HighlightCandidate { id: string; proposal: HighlightProposal }

// Candidate text is always sliced from raw source, never from normalized text.
// This is bounded lexical relevance, not proof of a new claim or a rewrite.
export function highlightCandidates(input: Parameters<LLMProvider["generate"]>[0]): HighlightCandidate[] {
  const requirement = input.requirement.text;
  const match = input.match;
  if (!match || !["STRONG", "PARTIAL"].includes(match.classification) ||
    input.evidence.some(item => explicitlyNegatesRequirement(requirement, `${item.text}\n${item.rawText ?? ""}`))) return [];
  const terms = evidenceTerms(requirement.replace(/\b(bachelor|master)['’]s\b/gi, "$1"));
  const qualifications = new Set(["production", "professional", "commercial", "expert", "expertise", "proficient", "advanced"]);
  const wanted = terms.filter(term => !qualifications.has(term));
  const results: HighlightCandidate[] = [];
  for (const item of input.evidence) {
    if (!match.evidenceIds.includes(item.id) || typeof item.rawText !== "string") continue;
    const raw = item.rawText;
    const available = evidenceTerms(raw);
    if (terms.some(term => qualifications.has(term) && !available.includes(term))) continue;
    // Preserve known compound technology boundaries: React Native isn't React.
    if (wanted.includes("react") && !wanted.includes("native") && /\breact\s+native\b/i.test(raw)) continue;
    if (match.classification === "PARTIAL" && wanted.some(term => !available.includes(term))) continue;
    const tokens = [...raw.matchAll(/[\p{L}\p{N}]+(?:[./+#'-][\p{L}\p{N}+#]+)*/gu)];
    let best: { proposal: HighlightProposal; coverage: number } | undefined;
    for (let start = 0; start < tokens.length; start++) {
      for (let end = start; end < Math.min(tokens.length, start + 8); end++) {
        const span = raw.slice(tokens[start].index!, tokens[end].index! + tokens[end][0].length);
        if (span.length > 100 || /[,;!?\n\r]/.test(span)) continue;
        const words = normalizeEvidenceText(span).split(" ");
        if (words.some((word, index) => index > 0 && word === words[index - 1])) continue;
        const spanTerms = evidenceTerms(span);
        // Retrieval's discontinuous action aliases (e.g. "kept ... running")
        // must not reward expanding a highlight around an entire sentence.
        // A literal action or inflection such as "Led" remains eligible.
        const matched = wanted.filter(term => spanTerms.includes(term) &&
          (isSubstantiveEvidenceTerm(term) || tokens.slice(start, end + 1).some(token => evidenceTerms(token[0]).includes(term))));
        if (!matched.some(isSubstantiveEvidenceTerm)) continue;
        // Endpoints must be part of the requested concept, not adjacent filler.
        // Multiword aliases (CI/CD) are evaluated as a complete phrase.
        if (start < end) {
          const withoutFirst = evidenceTerms(raw.slice(tokens[start + 1].index!, tokens[end].index! + tokens[end][0].length));
          const withoutLast = evidenceTerms(raw.slice(tokens[start].index!, tokens[end - 1].index! + tokens[end - 1][0].length));
          if (matched.every(term => withoutFirst.includes(term)) || matched.every(term => withoutLast.includes(term))) continue;
        }
        const proposal: HighlightProposal = { type: "highlight", targetEvidenceId: item.id, highlightText: span,
          evidenceIds: [item.id], reason: "Highlight existing resume text relevant to this requirement.", confidence: 0.5 };
        if (!resolveHighlight(proposal, [item])) continue;
        if (!best || matched.length > best.coverage ||
          (matched.length === best.coverage && span.length < best.proposal.highlightText.length)) best = { proposal, coverage: matched.length };
      }
    }
    if (best) results.push({ id: `c${results.length + 1}`, proposal: best.proposal });
  }
  return results;
}

import { containsEvidenceTerm, normalizeEvidenceText } from "./evidence-terms.util";

// Recognize explicit denials, not arbitrary occurrences of "no" or "not".
// Match the denied object against the requirement, rather than every technology
// elsewhere in the record. This intentionally is not general semantic negation.
export function explicitlyNegatesRequirement(requirement: string, evidence: string): boolean {
  const expanded = evidence.replace(/[’']/g, "'")
    .replace(/\b(?:haven't|hasn't|hadn't)\b/gi, "have not")
    .replace(/\b(?:didn't|don't|doesn't)\b/gi, "do not");
  // A period inside Node.js is not a sentence boundary. Contrast clauses have
  // independent scope; "No Python experience; built Java tools" denies Python.
  const clauses = expanded.split(/[;!?\r\n]|\.(?=\s|$)|\b(?:but|however)\b/i);
  const patterns = [
    /^\s*(.+?)\s+(?:experience|knowledge|skills?)\s*:\s*(?:none|nil)\s*$/i,
    /\bno\s+(?:(?:prior|previous|any|professional|production|commercial)\s+)*experience\s+(?:with|in|using)\s+(.+)$/i,
    /\bno\s+(.+?)\s+(?:experience|knowledge|skills?)\b/i,
    /\b(?:never|(?:have|do)\s+not)\s+(?:used|use|worked\s+with|work\s+with|learned|learnt)\s+(.+)$/i,
    /\bnot\s+experienced\s+(?:with|in)\s+(.+)$/i,
    /\bwithout\s+(.+?)\s+experience\b/i,
    /^\s*(.+?)\s+(?:(?:was|is)\s+(?:not|never)|(?:has|have)\s+(?:not|never)\s+been)\s+used\s*$/i,
  ];
  for (const clause of clauses) {
    for (const pattern of patterns) {
      for (const match of clause.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
        if (/\b(?:not|never)\s*$/i.test(clause.slice(0, match.index))) continue;
        // "No Python experience required" describes prerequisites, not a denial
        // of the person's experience.
        const tail = clause.slice((match.index ?? 0) + match[0].length);
        if (/^\s+(?:(?:is|was)\s+)?(?:required|needed|necessary)\b/i.test(tail)) continue;
        const qualifiers = match[0].toLowerCase().match(/\b(professional|production|commercial)\b/g) ?? [];
        // No professional Python experience does not deny a bare Python skill.
        if (qualifiers.some(qualifier => !containsEvidenceTerm(requirement, qualifier))) continue;
        // Normalize paired concepts before splitting lists: the "and" inside
        // continuous integration and continuous delivery is part of CI/CD.
        const subjects = match[1].split(",").flatMap(part => normalizeEvidenceText(part).split(/\b(?:and|or|nor)\b/));
        for (const subject of subjects) {
          const normalized = normalizeEvidenceText(subject)
            .replace(/^(?:(?:any|prior|previous|professional|production|commercial)\s+)+/, "")
            .replace(/\s+(?:at all|yet)$/, "");
          if (normalized && containsEvidenceTerm(requirement, normalized)) return true;
        }
      }
    }
  }
  return false;
}

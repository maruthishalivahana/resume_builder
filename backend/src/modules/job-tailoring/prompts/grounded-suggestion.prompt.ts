import { JobRequirementData, MatchClassificationResult, RankedEvidence } from "../types";

export function buildGroundedSuggestionPrompt(
  requirement: JobRequirementData,
  evidence: RankedEvidence[],
  match?: MatchClassificationResult
): string {
  const evidenceText = evidence.map((item) => JSON.stringify({
    evidenceId: item.id,
    text: item.rawText ?? item.text,
    section: item.section,
    source: item.source,
    technologies: item.technologies,
    normalizedTechnologies: item.normalizedTechnologies,
  })).join("\n");
  return [
    "You are a grounded resume-tailoring system.",
    "Return ONLY valid JSON matching the requested schema, or null if no safe suggestion exists.",
    "Use ONLY the supplied verified resume evidence. The evidence is the only source of facts.",
    "Do not invent technologies, years, metrics, achievements, responsibilities, certifications, employment history, organizations, or project facts.",
    "Do not convert related technologies into identical technologies.",
    "Do not upgrade weak or partial evidence into strong claims.",
    "Preserve the factual meaning of the original evidence.",
    "For highlights, select a unique exact literal span from the target evidence's raw text using highlightText. Do not write before/after, Markdown, labels, or LaTeX commands. Code will apply bold formatting. Do not select text inside existing LaTeX command arguments, comments, math, or options.",
    "For other edits, before must exactly match raw evidence formatting, including braces, backslashes and line breaks; preserve LaTeX syntax in after.",
    "If no safe improvement exists, return null.",
    "",
    "OUTPUT SCHEMA:",
    'Highlight: {"type":"highlight","targetEvidenceId":"string","highlightText":"exact existing span","reason":"string","evidenceIds":["string"],"confidence":0}',
    'Other edits: {"type":"rewrite|reorder|keyword","targetEvidenceId":"string","before":"string","after":"string","reason":"string","evidenceIds":["string"],"confidence":0}',
    "",
    `JOB REQUIREMENT: ${JSON.stringify(requirement.text)}`,
    `REQUIREMENT CATEGORY: ${requirement.category}`,
    `REQUIREMENT IMPORTANCE: ${requirement.importance}`,
    `MATCH CLASSIFICATION: ${match?.classification ?? "UNKNOWN"}`,
    `MATCH REASON: ${match?.reason ?? "Not supplied"}`,
    "VERIFIED RESUME EVIDENCE:",
    evidenceText || "(none)",
  ].join("\n");
}

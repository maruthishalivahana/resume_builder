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
    "CRITICAL: The `before` and `after` fields MUST be exact raw text strings that match the formatting of the provided evidence text exactly (including LaTeX braces, backslashes, and line breaks) so they can be securely patched.",
    "If no safe improvement exists, return null.",
    "",
    "OUTPUT SCHEMA:",
    '{"type":"rewrite|reorder|highlight|keyword","targetEvidenceId":"string","before":"string","after":"string","reason":"string","evidenceIds":["string"],"confidence":0}',
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

// Shared lexical matching, not semantic proof. Keep technology boundaries intact.
const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "with", "for", "from", "of", "to", "in", "on", "you", "your", "our", "are", "have", "has", "must", "using", "required", "preferred", "experience", "skills", "skill", "knowledge", "years", "year"]);
const GENERIC_ACTIONS = new Set(["maintain", "lead", "build", "built", "develop", "developed", "manage", "managed", "design", "designed", "implement", "implemented", "create", "created", "deploy", "deployed"]);

export function isSubstantiveEvidenceTerm(term: string): boolean {
  return !GENERIC_ACTIONS.has(term);
}

export function normalizeEvidenceText(text: string): string {
  return text.normalize("NFC").toLowerCase()
    .replace(/\b(node|react|next|express)\s*\.?\s*js\b/g, "$1js")
    .replace(/\brestful\s+apis?\b|\brest\s+apis?\b/g, "rest api")
    // Retrieval aliases only. Never apply these transformations to raw source
    // or claim-validation text. Delivery is not deployment; CI alone is not CI/CD.
    .replace(/\bcontinuous\s+integration\s*(?:and|&|\/)\s*(?:continuous\s+)?delivery\b/g, "cicd")
    .replace(/\bci\s*\/\s*cd\b/g, "cicd")
    .replace(/\bcicd\s+(?:workflows?|pipelines?)\b/g, "cicd pipeline")
    .replace(/\bmaintain(?:ed|ing|s)?\b/g, "maintain")
    .replace(/\bled\b/g, "lead")
    .replace(/\bkept\s+((?:[a-z0-9+#]+\s+){1,10})running\b/g, "maintain $1")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function evidenceTerms(text: string): string[] {
  return [...new Set(normalizeEvidenceText(text).split(" ").filter(term => term && !STOP_WORDS.has(term)))];
}

export function containsEvidenceTerm(text: string, term: string): boolean {
  const normalized = normalizeEvidenceText(term);
  return Boolean(normalized) && ` ${normalizeEvidenceText(text)} `.includes(` ${normalized} `);
}

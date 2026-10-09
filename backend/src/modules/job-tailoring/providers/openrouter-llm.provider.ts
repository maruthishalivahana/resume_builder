import { buildGroundedSuggestionPrompt } from "../prompts/grounded-suggestion.prompt";
import {
  GroundedSuggestion,
  JobRequirementData,
  MatchClassificationResult,
  RankedEvidence,
  StrictGenerationConstraints,
} from "../types";
import { LLMProvider } from "./interfaces";

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenRouterLLMProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = this.required(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");
    this.model = this.required(env.OPENROUTER_MODEL, "OPENROUTER_MODEL");
    this.baseUrl = env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  }

  async generate(input: {
    requirement: JobRequirementData;
    evidence: RankedEvidence[];
    constraints: StrictGenerationConstraints;
    match?: MatchClassificationResult;
  }): Promise<GroundedSuggestion | null> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Resume Tailoring Engine",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildGroundedSuggestionPrompt(input.requirement, input.evidence, input.match) },
          { role: "user", content: "Generate one safe grounded suggestion or null." },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter request failed with status ${response.status}`);
    }
    const payload = await response.json() as OpenRouterResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no structured content");
    return parseGroundedSuggestion(content);
  }

  private required(value: string | undefined, name: string): string {
    if (!value?.trim()) throw new Error(`${name} is required for OpenRouter LLM provider`);
    return value.trim();
  }
}

export function parseGroundedSuggestion(content: string): GroundedSuggestion | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenRouter returned invalid JSON for grounded suggestion");
  }
  if (parsed === null) return null;
  if (!isRecord(parsed) ||
    !["rewrite", "reorder", "highlight", "keyword"].includes(parsed.type as string) ||
    typeof parsed.targetEvidenceId !== "string" ||
    typeof parsed.before !== "string" ||
    typeof parsed.after !== "string" ||
    typeof parsed.reason !== "string" ||
    !Array.isArray(parsed.evidenceIds) ||
    !parsed.evidenceIds.every((id) => typeof id === "string") ||
    typeof parsed.confidence !== "number" ||
    !Number.isFinite(parsed.confidence) ||
    parsed.confidence < 0 ||
    parsed.confidence > 1) {
    throw new Error("OpenRouter returned a grounded suggestion with an invalid schema");
  }
  return {
    type: parsed.type as GroundedSuggestion["type"],
    targetEvidenceId: parsed.targetEvidenceId,
    before: parsed.before,
    after: parsed.after,
    reason: parsed.reason,
    evidenceIds: parsed.evidenceIds,
    confidence: parsed.confidence,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

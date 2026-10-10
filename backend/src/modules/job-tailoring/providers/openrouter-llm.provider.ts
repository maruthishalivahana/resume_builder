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
  private readonly timeoutMs: number;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = this.required(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");
    this.model = this.required(env.OPENROUTER_MODEL, "OPENROUTER_MODEL");
    this.baseUrl = env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this.timeoutMs = this.parseTimeout(env.OPENROUTER_TIMEOUT_MS);
  }

  async generate(input: {
    requirement: JobRequirementData;
    evidence: RankedEvidence[];
    constraints: StrictGenerationConstraints;
    match?: MatchClassificationResult;
  }): Promise<GroundedSuggestion | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tailoringDiagnostic, tailoringDiagnosticWarning } = require("../utils/tailoring-diagnostic.util");
    
    tailoringDiagnostic("openrouter.request.started", {
      model: this.model,
      evidenceCount: input.evidence.length,
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        tailoringDiagnosticWarning("openrouter.request.failed", { reason: "timeout", timeoutMs: this.timeoutMs });
        throw new Error(`OpenRouter request timed out after ${this.timeoutMs}ms`);
      }
      tailoringDiagnosticWarning("openrouter.request.failed", { reason: "network_error", message: error instanceof Error ? error.message : "unknown network error" });
      throw new Error(`OpenRouter request could not be completed: ${error instanceof Error ? error.message : "unknown network error"}`);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      const suffix = retryAfter ? `; retry-after=${retryAfter}` : "";
      tailoringDiagnosticWarning("openrouter.request.failed", { reason: "http_error", status: response.status, retryAfter });
      throw new Error(`OpenRouter request failed with status ${response.status}${suffix}`);
    }
    let payload: OpenRouterResponse;
    try {
      payload = await response.json() as OpenRouterResponse;
    } catch {
      tailoringDiagnosticWarning("openrouter.request.failed", { reason: "invalid_json" });
      throw new Error("OpenRouter returned an invalid JSON response envelope");
    }
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      tailoringDiagnosticWarning("openrouter.request.failed", { reason: "no_content" });
      throw new Error("OpenRouter returned no structured content");
    }
    
    tailoringDiagnostic("openrouter.request.completed", {
      model: this.model,
      contentLength: content.length,
    });
    
    return parseGroundedSuggestion(content);
  }

  private required(value: string | undefined, name: string): string {
    if (!value?.trim()) throw new Error(`${name} is required for OpenRouter LLM provider`);
    return value.trim();
  }

  private parseTimeout(value: string | undefined): number {
    if (!value?.trim()) return 30000;
    const timeout = Number(value);
    if (!Number.isInteger(timeout) || timeout <= 0) {
      throw new Error("OPENROUTER_TIMEOUT_MS must be a positive integer");
    }
    return timeout;
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

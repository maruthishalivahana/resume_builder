import { randomUUID } from "crypto";
import { buildGroundedSuggestionPrompt } from "../prompts/grounded-suggestion.prompt";
import {
  GroundedSuggestion,
  JobRequirementData,
  MatchClassificationResult,
  RankedEvidence,
  StrictGenerationConstraints,
} from "../types";
import { GenerationProposal, LLMProvider } from "./interfaces";

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
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
  }): Promise<GenerationProposal | null> {
    const controller = new AbortController();
    const startedAt = Date.now();
    const deadline = startedAt + this.timeoutMs;
    const requestId = randomUUID();
    let stage = "headers";
    let headersDurationMs: number | undefined;
    let bodyDurationMs: number | undefined;
    let resolvedModel: string | undefined;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    const prompt = buildGroundedSuggestionPrompt(input.requirement, input.evidence, input.match);
    const requestBody = JSON.stringify({
      model: this.model, temperature: 0, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Generate one safe grounded suggestion or null." },
      ],
    });
    const measurements = () => ({ requestId, requirementId: input.requirement.id,
      durationMs: Date.now() - startedAt, stage, headersDurationMs, bodyDurationMs,
      promptBytes: Buffer.byteLength(prompt, "utf8"), requestBytes: Buffer.byteLength(requestBody, "utf8"),
      resolvedModel, promptTokens, completionTokens });
    const timeout = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tailoringDiagnostic, tailoringDiagnosticWarning } = require("../utils/tailoring-diagnostic.util");
    const checkDeadline = (): void => {
      // Parsing is synchronous and cannot be interrupted by a timer; reject a
      // result that finishes past the deadline even if the timer has not run yet.
      if (controller.signal.aborted || Date.now() >= deadline) {
        controller.abort();
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "timeout", timeoutMs: this.timeoutMs });
        throw new Error(`OpenRouter request timed out after ${this.timeoutMs}ms`);
      }
    };
    tailoringDiagnostic("openrouter.request.started", {
      ...measurements(), model: this.model,
      evidenceCount: input.evidence.length,
    });

    try {
      checkDeadline();
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
          body: requestBody,
          signal: controller.signal,
        });
      } catch (error) {
        checkDeadline();
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "network_error", message: error instanceof Error ? error.message : "unknown network error" });
        throw new Error(`OpenRouter request could not be completed: ${error instanceof Error ? error.message : "unknown network error"}`);
      }
      headersDurationMs = Date.now() - startedAt;
      checkDeadline();
      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        const suffix = retryAfter ? `; retry-after=${retryAfter}` : "";
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "http_error", status: response.status, retryAfter });
        throw new Error(`OpenRouter request failed with status ${response.status}${suffix}`);
      }
      stage = "body";
      const bodyStartedAt = Date.now();
      let payload: OpenRouterResponse;
      try {
        payload = await response.json() as OpenRouterResponse;
      } catch (error) {
        checkDeadline();
        if (error instanceof SyntaxError) {
          tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "invalid_json" });
          throw new Error("OpenRouter returned an invalid JSON response envelope");
        }
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "body_read_error" });
        throw new Error("OpenRouter response body could not be completed");
      }
      bodyDurationMs = Date.now() - bodyStartedAt;
      checkDeadline();
      stage = "envelope";
      if (!isRecord(payload) || Array.isArray(payload) || (payload.choices !== undefined && !Array.isArray(payload.choices))) {
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "invalid_envelope" });
        throw new Error("OpenRouter returned an invalid response envelope");
      }
      const usage = isRecord(payload.usage) ? payload.usage : undefined;
      resolvedModel = typeof payload.model === "string" ? payload.model : undefined;
      promptTokens = typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
      completionTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : undefined;
      const content = payload.choices?.[0]?.message?.content;
      if (content === undefined || content === null || (typeof content === "string" && !content.trim())) {
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "no_content" });
        throw new Error("OpenRouter returned no structured content");
      }
      if (typeof content !== "string") {
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "invalid_structured_output" });
        throw new Error("OpenRouter returned invalid structured content");
      }
      stage = "structured_output";
      let suggestion: GenerationProposal | null;
      try {
        suggestion = parseGroundedSuggestion(content);
      } catch (error) {
        checkDeadline();
        tailoringDiagnosticWarning("openrouter.request.failed", { ...measurements(), reason: "invalid_structured_output" });
        throw error;
      }
      checkDeadline();
      tailoringDiagnostic("openrouter.request.completed", {
        ...measurements(), model: this.model,
        contentLength: content.length,
      });
      return suggestion;
    } finally {
      // The deadline covers headers, body reading, envelope and suggestion parsing.
      clearTimeout(timeout);
    }
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

export function parseGroundedSuggestion(content: string): GenerationProposal | null {
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
    !(parsed.type === "highlight" && typeof parsed.highlightText === "string" && parsed.highlightText.trim().length > 0 ||
      typeof parsed.before === "string" && typeof parsed.after === "string") ||
    typeof parsed.reason !== "string" ||
    !Array.isArray(parsed.evidenceIds) ||
    !parsed.evidenceIds.every((id) => typeof id === "string") ||
    typeof parsed.confidence !== "number" ||
    !Number.isFinite(parsed.confidence) ||
    parsed.confidence < 0 ||
    parsed.confidence > 1) {
    throw new Error("OpenRouter returned a grounded suggestion with an invalid schema");
  }
  if (parsed.type === "highlight" && typeof parsed.highlightText === "string") {
    if ("before" in parsed || "after" in parsed) throw new Error("Highlight spans must not supply replacement text");
    return { type: "highlight", highlightText: parsed.highlightText, targetEvidenceId: parsed.targetEvidenceId,
      reason: parsed.reason, evidenceIds: parsed.evidenceIds as string[], confidence: parsed.confidence };
  }
  return {
    type: parsed.type as GroundedSuggestion["type"],
    targetEvidenceId: parsed.targetEvidenceId,
    before: parsed.before as string,
    after: parsed.after as string,
    reason: parsed.reason,
    evidenceIds: parsed.evidenceIds,
    confidence: parsed.confidence,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import "../../../config/env";
import { LLMProvider, DeterministicTailoringGenerator } from "../providers/interfaces";
import { OpenRouterLLMProvider } from "../providers/openrouter-llm.provider";
import { tailoringDiagnostic, tailoringDiagnosticWarning } from "../utils/tailoring-diagnostic.util";

export type SupportedLLMProvider = "openrouter" | "deterministic";

export interface TailoringProviderConfig {
  requestedProviderRaw: string | undefined;
  normalizedProvider: SupportedLLMProvider;
  isValid: boolean;
  model: string;
  primaryProvider: LLMProvider;
  fallbackProvider?: LLMProvider;
}

export function resolveTailoringProviderConfig(): TailoringProviderConfig {
  const raw = process.env.LLM_PROVIDER;
  const trimmed = raw ? raw.trim().toLowerCase() : "";

  if (!trimmed) {
    const errorMsg = "LLM_PROVIDER is not set. Supported values are 'openrouter' or 'deterministic'.";
    tailoringDiagnosticWarning("provider.config_missing", {
      reason: errorMsg,
      supportedValues: "openrouter, deterministic",
    });
    throw new Error(`[Configuration Error] ${errorMsg}`);
  }

  if (trimmed !== "openrouter" && trimmed !== "deterministic") {
    const errorMsg = `Invalid LLM_PROVIDER '${raw}'. Supported values are 'openrouter' or 'deterministic'.`;
    tailoringDiagnosticWarning("provider.config_invalid", {
      requested: raw,
      supportedValues: "openrouter, deterministic",
      reason: errorMsg,
    });
    throw new Error(`[Configuration Error] ${errorMsg}`);
  }

  if (trimmed === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      const errorMsg = "OPENROUTER_API_KEY is missing or empty while LLM_PROVIDER=openrouter.";
      tailoringDiagnosticWarning("provider.credentials_missing", {
        provider: "openrouter",
        reason: errorMsg,
      });
      throw new Error(`[Configuration Error] ${errorMsg}`);
    }

    const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
    const primaryProvider = new OpenRouterLLMProvider();
    // Deterministic generator available as intentional fallback
    const fallbackProvider = new DeterministicTailoringGenerator();

    tailoringDiagnostic("provider.initialized", {
      provider: "OpenRouterLLMProvider",
      model,
      fallbackConfigured: true,
    });

    return {
      requestedProviderRaw: raw,
      normalizedProvider: "openrouter",
      isValid: true,
      model,
      primaryProvider,
      fallbackProvider,
    };
  }

  // trimmed === "deterministic"
  const primaryProvider = new DeterministicTailoringGenerator();
  tailoringDiagnostic("provider.initialized", {
    provider: "DeterministicTailoringGenerator",
    model: "deterministic",
    fallbackConfigured: false,
  });

  return {
    requestedProviderRaw: raw,
    normalizedProvider: "deterministic",
    isValid: true,
    model: "deterministic",
    primaryProvider,
    fallbackProvider: undefined,
  };
}

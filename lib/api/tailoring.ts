const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Helper to execute fetch requests with network error handling.
 */
async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (
      err instanceof TypeError ||
      (err as Error)?.name === "TypeError" ||
      (err as Error)?.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Unable to connect to backend server at ${API_URL}. Please ensure the backend server is running.`
      );
    }
    throw err;
  }
}

export interface TailoringSuggestionView {
  suggestionId: string;
  projectId: string;
  versionId: string;
  requirementId: string;
  requirement: string;
  classification?: string;
  status: "pending" | "accepted" | "edited" | "rejected" | "failed";
  validation: "PASS" | "FAIL";
  confidence: number;
  before?: string;
  after?: string;
  reason: string;
  evidence: Array<{ evidenceId: string; fileId: string; fileName: string; lineStart: number; lineEnd: number; text: string }>;
}

export interface ExtractedRequirement {
  id: string;
  text: string;
  category: string;
  importance: string;
  extractedTerms: string[];
  normalizedTerms: string[];
  originalText?: string;
  cleanText?: string;
}

export interface TailoringAnalysisView {
  analysisId: string;
  status: "pending" | "running" | "completed" | "failed";
  summary?: Record<string, number>;
  diagnosticReasons?: Record<string, number>;
  requirements: Array<ExtractedRequirement & {
    requirementId: string;
    match?: {
      classification: string;
      confidence: number;
      reason: string;
      reasonCode?: string;
      evidenceIds: string[];
    } | null;
  }>;
}

async function parseResponse(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error((body as { message?: string } | null)?.message || `Request failed (${response.status})`);
  return body;
}

async function postTailoring<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await safeFetch(`${API_URL}/api/tailoring${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await parseResponse(response) as { success?: boolean; data?: T };
  return result.data as T;
}

export async function indexTailoringResume(projectId: string, versionId: string): Promise<void> {
  await postTailoring("/resume/index", { projectId, versionId });
  await postTailoring("/resume/embeddings/index", { projectId, versionId });
}

export async function extractTailoringRequirements(rawJobDescription: string): Promise<ExtractedRequirement[]> {
  return postTailoring<ExtractedRequirement[]>("/requirements", { rawJobDescription });
}

export async function analyzeTailoring(
  projectId: string,
  versionId: string,
  rawJobDescription: string
): Promise<{ analysisId: string; summary: Record<string, number> }> {
  return postTailoring("/analyze", { projectId, versionId, rawJobDescription });
}

export async function fetchTailoringAnalysis(analysisId: string): Promise<TailoringAnalysisView> {
  const response = await safeFetch(`${API_URL}/api/tailoring/${encodeURIComponent(analysisId)}`, { cache: "no-store" });
  const body = await parseResponse(response) as { data?: TailoringAnalysisView };
  if (!body.data) throw new Error("Analysis response was empty.");
  return body.data;
}

export async function analyzeTailoringMatches(
  projectId: string,
  versionId: string,
  requirementIds: string[]
): Promise<unknown> {
  return postTailoring("/matches/analyze", { projectId, versionId, requirementIds });
}

export async function generateTailoringSuggestion(
  projectId: string,
  versionId: string,
  requirementId: string
): Promise<unknown> {
  return postTailoring("/suggestions/generate", { projectId, versionId, requirementId });
}

export async function fetchTailoringSuggestions(projectId: string, versionId: string, analysisId?: string): Promise<TailoringSuggestionView[]> {
  const query = `projectId=${encodeURIComponent(projectId)}&versionId=${encodeURIComponent(versionId)}${analysisId ? `&analysisId=${encodeURIComponent(analysisId)}` : ""}`;
  const response = await safeFetch(`${API_URL}/api/tailoring/suggestions?${query}`, { cache: "no-store" });
  const body = await parseResponse(response) as { success?: boolean; data?: TailoringSuggestionView[] };
  return body.data ?? [];
}

export async function rejectTailoringSuggestion(suggestionId: string, projectId: string, versionId: string): Promise<void> {
  const response = await safeFetch(`${API_URL}/api/tailoring/suggestions/${encodeURIComponent(suggestionId)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId }),
  });
  await parseResponse(response);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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

async function parseResponse(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error((body as { message?: string } | null)?.message || `Request failed (${response.status})`);
  return body;
}

export async function fetchTailoringSuggestions(projectId: string, versionId: string): Promise<TailoringSuggestionView[]> {
  const response = await fetch(`${API_URL}/api/tailoring/suggestions?projectId=${encodeURIComponent(projectId)}&versionId=${encodeURIComponent(versionId)}`, { cache: "no-store" });
  const body = await parseResponse(response) as { success?: boolean; data?: TailoringSuggestionView[] };
  return body.data ?? [];
}

export async function rejectTailoringSuggestion(suggestionId: string, projectId: string, versionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/tailoring/suggestions/${encodeURIComponent(suggestionId)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, versionId }),
  });
  await parseResponse(response);
}

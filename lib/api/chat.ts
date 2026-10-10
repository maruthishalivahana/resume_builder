export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  success: boolean;
  data: {
    message: string;
    history: ChatMessageItem[];
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function sendChatMessageApi(
  message: string,
  history?: ChatMessageItem[],
  projectId?: string
): Promise<ChatResponse["data"]> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      history,
      projectId,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to send chat message.");
  }

  return payload.data;
}

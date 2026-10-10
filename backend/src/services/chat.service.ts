import { LatexFile } from "../models/LatexFile";
import { ChatMessage, ChatProvider, DeterministicChatProvider, OpenRouterChatProvider } from "../providers/chat.provider";
import { AppError } from "../middleware/error.middleware";

export interface ChatServiceInput {
  message: string;
  history?: ChatMessage[];
  projectId?: string;
}

export interface ChatServiceResult {
  message: string;
  history: ChatMessage[];
}

export class ChatService {
  private readonly provider: ChatProvider;

  constructor(provider?: ChatProvider) {
    if (provider) {
      this.provider = provider;
    } else if (process.env.LLM_PROVIDER === "openrouter" && process.env.OPENROUTER_API_KEY?.trim()) {
      this.provider = new OpenRouterChatProvider();
    } else {
      this.provider = new DeterministicChatProvider();
    }
  }

  async processChat(input: ChatServiceInput): Promise<ChatServiceResult> {
    const rawMessage = input.message;
    if (typeof rawMessage !== "string" || !rawMessage.trim()) {
      throw new AppError("Message is required and must be a non-empty string.", 400);
    }
    if (rawMessage.length > 2000) {
      throw new AppError("Message exceeds maximum length of 2000 characters.", 400);
    }

    const trimmedMessage = rawMessage.trim();

    // Sanitize and limit history to last 10 messages
    const rawHistory = Array.isArray(input.history) ? input.history : [];
    const validHistory: ChatMessage[] = rawHistory
      .filter((h) => isObject(h) && (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.trim())
      .slice(-10)
      .map((h) => ({ role: h.role, content: h.content.trim() }));

    // Fetch resume context if projectId supplied
    let resumeContext: string | undefined = undefined;
    if (input.projectId && typeof input.projectId === "string" && input.projectId.trim()) {
      try {
        const files = await LatexFile.find({ projectId: input.projectId.trim() }).lean();
        if (files.length > 0) {
          resumeContext = files
            .map((f) => `--- File: ${f.name} ---\n${f.content || ""}`)
            .join("\n\n")
            .slice(0, 4000); // cap context size
        }
      } catch {
        // Resume context lookup failure should not break chat
      }
    }

    const messagesToProvider: ChatMessage[] = [
      ...validHistory,
      { role: "user", content: trimmedMessage },
    ];

    let reply: string;
    try {
      reply = await this.provider.chat({
        messages: messagesToProvider,
        resumeContext,
      });
    } catch (providerError) {
      if (this.provider instanceof OpenRouterChatProvider) {
        console.warn("[ChatService] OpenRouter failed, falling back to DeterministicChatProvider:", providerError);
        const fallback = new DeterministicChatProvider();
        reply = await fallback.chat({
          messages: messagesToProvider,
          resumeContext,
        });
      } else {
        throw providerError;
      }
    }

    const updatedHistory: ChatMessage[] = [
      ...validHistory,
      { role: "user", content: trimmedMessage },
      { role: "assistant", content: reply },
    ];

    return {
      message: reply,
      history: updatedHistory,
    };
  }
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null;
}

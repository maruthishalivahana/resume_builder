export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatProvider {
  chat(input: {
    messages: ChatMessage[];
    resumeContext?: string;
  }): Promise<string>;
}

export class OpenRouterChatProvider implements ChatProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = env.OPENROUTER_API_KEY?.trim() || "";
    this.model = env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
    this.baseUrl = env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this.timeoutMs = Number(env.OPENROUTER_TIMEOUT_MS) || 30000;
  }

  async chat(input: { messages: ChatMessage[]; resumeContext?: string }): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const systemPrompt = `You are RESUME.ENG AI Copilot, an expert AI assistant specializing in resume engineering, LaTeX resume optimization, ATS alignment, and career advice.
Provide clear, actionable, professional advice.
CRITICAL CONSTRAINT: Do NOT invent fake employment history, fake degrees, or fake metrics for the user. If resume context is provided below, base your technical suggestions on that evidence. If context is missing and needed, ask the candidate for details.

${input.resumeContext ? `Candidate Resume Context:\n"""\n${input.resumeContext}\n"""` : ""}`;

    const formattedMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...input.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "RESUME.ENG Copilot",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.7,
          messages: formattedMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API request failed with status ${response.status}`);
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        throw new Error("OpenRouter returned an empty chat response");
      }
      return reply;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Chat request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class DeterministicChatProvider implements ChatProvider {
  async chat(input: { messages: ChatMessage[]; resumeContext?: string }): Promise<string> {
    const lastUserMsg = [...input.messages].reverse().find((m) => m.role === "user")?.content || "";
    const lower = lastUserMsg.toLowerCase();

    if (lower.includes("header") || lower.includes("contact")) {
      return "To improve your resume header, ensure your full name is clear at the top, followed by professional contact details (Email, Phone, LinkedIn, and GitHub/Portfolio links). Keep line height clean and avoid multi-column tables in standard parsers.";
    }
    if (lower.includes("ats") || lower.includes("parser")) {
      return "For ATS optimization, use standard LaTeX section headers (e.g. \\section*{Experience}), list technical skills explicitly, and avoid non-standard fonts, tables, or background images.";
    }
    if (lower.includes("latex") || lower.includes("compile")) {
      return "Ensure all environments (such as \\begin{itemize}) are properly closed with \\end{itemize}, and check that special LaTeX characters like %, &, $, and _ are properly escaped with backslashes.";
    }
    if (input.resumeContext) {
      return `Based on your resume context, here is my suggestion: Highlight your key achievements with strong action verbs and quantified impact where verified. For example: "${lastUserMsg.slice(0, 60)}..."`;
    }

    return "Hello! I am your RESUME.ENG AI Copilot. I can help you refine your LaTeX code, optimize section content for ATS systems, and tailor bullets to job requirements. What would you like to improve?";
  }
}

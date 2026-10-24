
export type ContentFormat =
  | "Social post"
  | "Story"
  | "Video script"
  | "Image concept";

export interface GenerationRequest {
  idea: string;
  format: ContentFormat;
  audience?: string;
  tone?: string;
  language?: string;
}

export interface GenerationResponse {
  id: string;
  content: string;
  model: string;
  adapter?: string;
}

export interface EngineStatus {
  connected: boolean;
  engine: string;
  model: string | null;
  message: string;
}

function getEngineUrl(): string | null {
  const configuredUrl = import.meta.env.VITE_AI_ENGINE_URL?.trim();

  if (!configuredUrl) {
    return null;
  }

  try {
    const url = new URL(configuredUrl);

    if (
      url.protocol !== "https:" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      throw new Error("The AI engine must use HTTPS.");
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new Error("The AI engine URL is invalid or insecure.");
  }
}

export async function getEngineStatus(): Promise<EngineStatus> {
  const baseUrl = getEngineUrl();

  if (!baseUrl) {
    return {
      connected: false,
      engine: "GrowthFlow Self-Hosted Engine",
      model: null,
      message: "Our own AI engine has not been configured yet.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error("Health check failed.");
    }

    const data: { status?: string; model?: string } =
      await response.json();

    if (data.status !== "ok") {
      throw new Error("The engine is not ready.");
    }

    return {
      connected: true,
      engine: "GrowthFlow Self-Hosted Engine",
      model: data.model ?? null,
      message: "Our engine is responding.",
    };
  } catch {
    return {
      connected: false,
      engine: "GrowthFlow Self-Hosted Engine",
      model: null,
      message: "Our own engine is currently unavailable.",
    };
  }
}

export async function generateContent(
  request: GenerationRequest,
): Promise<GenerationResponse> {
  const baseUrl = getEngineUrl();

  if (!baseUrl) {
    throw new Error(
      "Our own AI engine is not configured yet. No generation request was sent.",
    );
  }

  if (!request.idea.trim()) {
    throw new Error("Enter an idea before requesting generation.");
  }

  if (request.idea.length > 10000) {
    throw new Error("The idea exceeds the allowed length.");
  }

  const response = await fetch(`${baseUrl}/v1/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      idea: request.idea.trim(),
      format: request.format,
      audience: request.audience?.trim(),
      tone: request.tone?.trim(),
      language: request.language?.trim(),
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(
      `Our AI engine returned an error (${response.status}).`,
    );
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data) ||
    typeof data.id !== "string" ||
    !("content" in data) ||
    typeof data.content !== "string" ||
    !("model" in data) ||
    typeof data.model !== "string"
  ) {
    throw new Error("The AI engine returned an invalid response.");
  }

  return {
    id: data.id,
    content: data.content,
    model: data.model,
    adapter:
      "adapter" in data && typeof data.adapter === "string"
        ? data.adapter
        : undefined,
  };
}

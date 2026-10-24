export type ContentFormat =
  | "Social post"
  | "Story"
  | "Video script"
  | "Image concept";

export type GenerationRequest = {
  idea: string;
  format: ContentFormat;
  audience?: string;
  tone?: string;
  language?: string;
};

export type GenerationResponse = {
  id: string;
  content: string;
  model: string;
  adapter: string | null;
};

const REQUEST_TIMEOUT_MS = 90_000;

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_GROWTHFLOW_API_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "GrowthFlow's generation API is not configured yet. Set VITE_GROWTHFLOW_API_URL to your backend's base URL.",
    );
  }

  const normalizedUrl = configuredUrl.replace(/\/+$/, "");

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error("The configured GrowthFlow API URL is invalid.");
  }

  const isLocalHost =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1";

  if (parsedUrl.protocol !== "https:" && !isLocalHost) {
    throw new Error(
      "The generation API must use HTTPS outside local development.",
    );
  }

  return normalizedUrl;
}

async function readErrorMessage(
  response: Response,
): Promise<string> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return `The generation service returned an unexpected response (${response.status}).`;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload
  ) {
    const detail = payload.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "msg" in item &&
            typeof item.msg === "string"
          ) {
            return item.msg;
          }

          return "The request contains invalid data.";
        })
        .join(" ");
    }
  }

  return `The generation service could not complete the request (${response.status}).`;
}

export async function generateContent(
  request: GenerationRequest,
): Promise<GenerationResponse> {
  const idea = request.idea.trim();

  if (!idea) {
    throw new Error("Enter an idea before generating content.");
  }

  if (idea.length > 10_000) {
    throw new Error("Your brief must be 10,000 characters or fewer.");
  }

  const controller = new AbortController();

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const apiBaseUrl = getApiBaseUrl();

    const response = await fetch(`${apiBaseUrl}/v1/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...request,
        idea,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new Error(
        "The generation service returned invalid JSON.",
      );
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("id" in payload) ||
      typeof payload.id !== "string" ||
      !("content" in payload) ||
      typeof payload.content !== "string" ||
      !payload.content.trim() ||
      !("model" in payload) ||
      typeof payload.model !== "string"
    ) {
      throw new Error(
        "The generation service returned an incomplete response.",
      );
    }

    return {
      id: payload.id,
      content: payload.content,
      model: payload.model,
      adapter:
        "adapter" in payload &&
        typeof payload.adapter === "string"
          ? payload.adapter
          : null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Generation took too long and was stopped. Try again with a shorter brief.",
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the generation service. Check the API URL, network connection, and backend CORS configuration.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

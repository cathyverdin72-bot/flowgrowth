
import { supabase } from "./supabase";

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

export async function generateContent(
  request: GenerationRequest,
): Promise<GenerationResponse> {
  const idea = request.idea.trim();

  if (!idea) {
    throw new Error("Enter an idea before generating content.");
  }

  if (idea.length > 10_000) {
    throw new Error(
      "Your brief must be 10,000 characters or fewer.",
    );
  }

  let data: unknown;

  try {
    const result = await supabase.functions.invoke("generate", {
      body: {
        ...request,
        idea,
      },
    });

    if (result.error) {
      const error = result.error;
      const context =
        "context" in error ? error.context : undefined;

      if (context instanceof Response) {
        let detail = "";

        try {
          const payload: unknown = await context.clone().json();

          if (
            typeof payload === "object" &&
            payload !== null &&
            "detail" in payload &&
            typeof payload.detail === "string"
          ) {
            detail = payload.detail;
          }
        } catch {
          // Use the safe fallback below if the response isn't JSON.
        }

        if (detail) {
          throw new Error(detail);
        }
      }

      const message = error.message.toLowerCase();

      if (
        message.includes("jwt") ||
        message.includes("unauthorized") ||
        message.includes("401")
      ) {
        throw new Error(
          "Please sign in again before generating content.",
        );
      }

      throw new Error(
        "GrowthFlow could not reach its generation service. Check your connection and try again.",
      );
    }

    data = result.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "An unexpected error occurred during generation.",
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data) ||
    typeof data.id !== "string" ||
    !("content" in data) ||
    typeof data.content !== "string" ||
    !data.content.trim() ||
    !("model" in data) ||
    typeof data.model !== "string"
  ) {
    throw new Error(
      "The generation service returned an incomplete response.",
    );
  }

  return {
    id: data.id,
    content: data.content,
    model: data.model,
    adapter:
      "adapter" in data && typeof data.adapter === "string"
        ? data.adapter
        : null,
  };
}

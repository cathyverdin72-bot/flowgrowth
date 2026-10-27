const ALLOWED_ORIGIN = "https://growthflow-7tyx.onrender.com";

const ALLOWED_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
]);

const ALLOWED_QUALITIES = new Set([
  "low",
  "medium",
  "high",
]);

const MAX_PROMPT_LENGTH = 4000;
const MAX_RESPONSE_BYTES = 36 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function safeError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("Origin");

  // Allow only the configured GrowthFlow web application in browsers.
  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response("Forbidden origin", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return safeError("Method not allowed.", 405);
  }

  // Supabase must also enforce JWT verification at its API gateway.
  const greyflowBaseUrl = Deno.env
    .get("GREYFLOW_API_URL")
    ?.trim();

  const greyflowApiKey = Deno.env
    .get("GREYFLOW_API_KEY")
    ?.trim();

  if (!greyflowBaseUrl || !greyflowApiKey) {
    return safeError(
      "Image generation is not configured on the server.",
      503,
    );
  }

  let upstreamUrl: URL;

  try {
    const baseUrl = new URL(greyflowBaseUrl);

    // Require HTTPS for deployed services. Local HTTP is permitted
    // only for local development.
    const localHost = new Set([
      "localhost",
      "127.0.0.1",
      "[::1]",
    ]).has(baseUrl.hostname);

    if (
      baseUrl.protocol !== "https:" &&
      !(baseUrl.protocol === "http:" && localHost)
    ) {
      return safeError(
        "The configured image service URL is invalid.",
        503,
      );
    }

    if (
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.search ||
      baseUrl.hash
    ) {
      return safeError(
        "The configured image service URL is invalid.",
        503,
      );
    }

    upstreamUrl = new URL(
      "/v1/images/generations",
      baseUrl.origin,
    );
  } catch {
    return safeError(
      "The configured image service URL is invalid.",
      503,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return safeError("Request body must be valid JSON.", 400);
  }

  if (!isRecord(body)) {
    return safeError("Request body must be a JSON object.", 400);
  }

  const prompt = body.prompt;

  if (typeof prompt !== "string") {
    return safeError("A prompt is required.", 400);
  }

  const trimmedPrompt = prompt.trim();

  if (
    trimmedPrompt.length === 0 ||
    trimmedPrompt.length > MAX_PROMPT_LENGTH
  ) {
    return safeError(
      `Prompt must contain between 1 and ${MAX_PROMPT_LENGTH} characters.`,
      400,
    );
  }

  const size = body.size ?? "1024x1024";
  const quality = body.quality ?? "medium";

  if (
    typeof size !== "string" ||
    !ALLOWED_SIZES.has(size)
  ) {
    return safeError("Unsupported image size.", 400);
  }

  if (
    typeof quality !== "string" ||
    !ALLOWED_QUALITIES.has(quality)
  ) {
    return safeError("Unsupported image quality.", 400);
  }

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GreyFlow-API-Key": greyflowApiKey,
      },
      body: JSON.stringify({
        prompt: trimmedPrompt,
        size,
        quality,
      }),
      signal: AbortSignal.timeout(115_000),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "TimeoutError"
    ) {
      return safeError(
        "Image generation timed out. Check service status before retrying.",
        504,
      );
    }

    return safeError(
      "The image service could not be reached.",
      502,
    );
  }

  if (!upstreamResponse.ok) {
    // Do not expose GreyFlow's internal errors or provider details.
    if (upstreamResponse.status === 429) {
      return safeError(
        "Image generation is temporarily rate-limited.",
        429,
      );
    }

    if (
      upstreamResponse.status === 401 ||
      upstreamResponse.status === 403
    ) {
      return safeError(
        "The image service rejected the server credentials.",
        502,
      );
    }

    if (
      upstreamResponse.status === 503 ||
      upstreamResponse.status === 504
    ) {
      return safeError(
        "The image service is temporarily unavailable.",
        503,
      );
    }

    return safeError(
      "Image generation could not be completed.",
      502,
    );
  }

  const declaredLength = Number(
    upstreamResponse.headers.get("Content-Length") ?? "0",
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RESPONSE_BYTES
  ) {
    return safeError(
      "The image service response exceeded the size limit.",
      502,
    );
  }

  let upstreamBody: unknown;

  try {
    const responseBytes = await upstreamResponse.arrayBuffer();

    if (responseBytes.byteLength > MAX_RESPONSE_BYTES) {
      return safeError(
        "The image service response exceeded the size limit.",
        502,
      );
    }

    const responseText = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(responseBytes);

    upstreamBody = JSON.parse(responseText);
  } catch {
    return safeError(
      "The image service returned an invalid response.",
      502,
    );
  }

  if (!isRecord(upstreamBody)) {
    return safeError(
      "The image service returned an invalid response.",
      502,
    );
  }

  if (
    upstreamBody.status !== "completed" ||
    !Array.isArray(upstreamBody.images) ||
    upstreamBody.images.length !== 1
  ) {
    return safeError(
      "The image service did not return a completed image.",
      502,
    );
  }

  const image = upstreamBody.images[0];

  if (!isRecord(image)) {
    return safeError(
      "The image service returned invalid image data.",
      502,
    );
  }

  const dataUrl = image.data_url;
  const imageSize = image.size;
  const imageFormat = image.format;
  const model = image.model;

  // GreyFlow's synchronous endpoint contract returns PNG data URLs.
  if (
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:image/png;base64,") ||
    dataUrl.length > MAX_RESPONSE_BYTES ||
    imageFormat !== "png" ||
    imageSize !== size ||
    typeof model !== "string" ||
    model.length === 0 ||
    model.length > 200
  ) {
    return safeError(
      "The image service returned invalid image data.",
      502,
    );
  }

  const encodedPng = dataUrl.slice(
    "data:image/png;base64,".length,
  );

  // Reject malformed Base64 rather than passing arbitrary data
  // into the browser.
  if (
    encodedPng.length === 0 ||
    encodedPng.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encodedPng)
  ) {
    return safeError(
      "The image service returned invalid image data.",
      502,
    );
  }

  // Return only the fields GrowthFlow needs.
  // Never return the GreyFlow API key or internal provider errors.
  return jsonResponse({
    status: "completed",
    images: [
      {
        model,
        size,
        format: "png",
        data_url: dataUrl,
      },
    ],
  });
});

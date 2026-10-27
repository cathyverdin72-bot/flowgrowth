
const ALLOWED_ORIGIN = "https://growthflow-7tyx.onrender.com";
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 36 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 4000;
const AUTH_TIMEOUT_MS = 10_000;
const GENERATION_TIMEOUT_MS = 115_000;

const ALLOWED_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
]);

const ALLOWED_QUALITIES = new Set(["low", "medium", "high"]);

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
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}

async function readLimited(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Uint8Array> {
  if (!stream) throw new Error("Missing response body.");

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error("Payload too large.");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

async function requireSignedInUser(
  request: Request,
): Promise<Response | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseKey = (
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    ""
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    return safeError(
      "User authentication is not configured on the server.",
      503,
    );
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);

  if (!match) {
    return safeError("Sign in before generating an image.", 401);
  }

  let authUrl: URL;

  try {
    authUrl = new URL("/auth/v1/user", supabaseUrl);
    if (authUrl.protocol !== "https:") {
      return safeError("Authentication configuration is invalid.", 503);
    }
  } catch {
    return safeError("Authentication configuration is invalid.", 503);
  }

  try {
    const response = await fetch(authUrl, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return safeError("Sign in before generating an image.", 401);
    }

    const user: unknown = await response.json();

    if (!isRecord(user) || typeof user.id !== "string" || !user.id) {
      return safeError("Sign in before generating an image.", 401);
    }

    return null;
  } catch {
    return safeError(
      "User authentication is temporarily unavailable.",
      503,
    );
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("Origin");

  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response("Forbidden origin", { status: 403 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return safeError("Method not allowed.", 405);
  }

  // Configure the Supabase function with verify_jwt = true as well.
  const authError = await requireSignedInUser(request);
  if (authError) return authError;

  const greyflowBaseUrl = Deno.env.get("GREYFLOW_API_URL")?.trim();
  const greyflowApiKey = Deno.env.get("GREYFLOW_API_KEY")?.trim();

  if (!greyflowBaseUrl || !greyflowApiKey) {
    return safeError(
      "Image generation is not configured on the server.",
      503,
    );
  }

  let baseUrl: URL;

  try {
    baseUrl = new URL(greyflowBaseUrl);

    if (
      baseUrl.protocol !== "https:" ||
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.search ||
      baseUrl.hash
    ) {
      return safeError("The image service URL is invalid.", 503);
    }
  } catch {
    return safeError("The image service URL is invalid.", 503);
  }

  const upstreamUrl = new URL(
    "/v1/images/generations",
    baseUrl.origin,
  );

  const declaredRequestLength = Number(
    request.headers.get("Content-Length") ?? "0",
  );

  if (
    Number.isFinite(declaredRequestLength) &&
    declaredRequestLength > MAX_REQUEST_BYTES
  ) {
    return safeError("Request body is too large.", 413);
  }

  let body: unknown;

  try {
    const bytes = await readLimited(request.body, MAX_REQUEST_BYTES);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    body = JSON.parse(text);
  } catch {
    return safeError(
      "Request body must be valid JSON within the size limit.",
      400,
    );
  }

  if (!isRecord(body)) {
    return safeError("Request body must be a JSON object.", 400);
  }

  if (
    typeof body.prompt !== "string" ||
    body.prompt.trim().length === 0 ||
    body.prompt.trim().length > MAX_PROMPT_LENGTH
  ) {
    return safeError(
      `Prompt must contain between 1 and ${MAX_PROMPT_LENGTH} characters.`,
      400,
    );
  }

  const prompt = body.prompt.trim();
  const size = body.size ?? "1024x1024";
  const quality = body.quality ?? "medium";

  if (typeof size !== "string" || !ALLOWED_SIZES.has(size)) {
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
      body: JSON.stringify({ prompt, size, quality }),
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return safeError(
        "Image generation timed out. Check job status before retrying.",
        504,
      );
    }

    return safeError("The image service could not be reached.", 502);
  }

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 429) {
      return safeError("Image generation is temporarily rate-limited.", 429);
    }

    if ([503, 504].includes(upstreamResponse.status)) {
      return safeError("The image service is temporarily unavailable.", 503);
    }

    return safeError("Image generation could not be completed.", 502);
  }

  const declaredResponseLength = Number(
    upstreamResponse.headers.get("Content-Length") ?? "0",
  );

  if (
    Number.isFinite(declaredResponseLength) &&
    declaredResponseLength > MAX_RESPONSE_BYTES
  ) {
    return safeError("The image service response is too large.", 502);
  }

  let upstreamBody: unknown;

  try {
    const bytes = await readLimited(
      upstreamResponse.body,
      MAX_RESPONSE_BYTES,
    );
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    upstreamBody = JSON.parse(text);
  } catch {
    return safeError("The image service returned an invalid response.", 502);
  }

  if (
    !isRecord(upstreamBody) ||
    upstreamBody.status !== "completed" ||
    !Array.isArray(upstreamBody.images) ||
    upstreamBody.images.length !== 1
  ) {
    return safeError("The image service returned no completed image.", 502);
  }

  const image = upstreamBody.images[0];

  if (!isRecord(image)) {
    return safeError("The image service returned invalid image data.", 502);
  }

  const dataUrl = image.data_url;
  const model = image.model;

  if (
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:image/png;base64,") ||
    dataUrl.length > MAX_RESPONSE_BYTES ||
    image.format !== "png" ||
    image.size !== size ||
    typeof model !== "string" ||
    model.length === 0 ||
    model.length > 200
  ) {
    return safeError("The image service returned invalid image data.", 502);
  }

  const encodedPng = dataUrl.slice("data:image/png;base64,".length);

  if (
    encodedPng.length === 0 ||
    encodedPng.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encodedPng)
  ) {
    return safeError("The image service returned invalid image data.", 502);
  }

  return jsonResponse({
    status: "completed",
    images: [{
      model,
      size,
      format: "png",
      data_url: dataUrl,
    }],
  });
});

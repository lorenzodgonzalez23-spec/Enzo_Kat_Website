export function getAllowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

export function originErrorResponse(): Response {
  return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function readJsonBody(
  request: Request,
): Promise<{ value: unknown; error: null } | { value: null; error: Response }> {
  if (
    !request.headers.get("content-type")?.toLowerCase().startsWith(
      "application/json",
    )
  ) {
    return {
      value: null,
      error: jsonResponse(
        { error: "invalid_content_type" },
        415,
        request.headers.get("origin") ?? "",
      ),
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > 16_384) {
    return {
      value: null,
      error: jsonResponse(
        { error: "request_too_large" },
        413,
        request.headers.get("origin") ?? "",
      ),
    };
  }

  try {
    return { value: JSON.parse(rawBody), error: null };
  } catch {
    return {
      value: null,
      error: jsonResponse(
        { error: "invalid_json" },
        400,
        request.headers.get("origin") ?? "",
      ),
    };
  }
}

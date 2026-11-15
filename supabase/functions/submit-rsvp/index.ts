import { validateSubmission } from "./validation.ts";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }
  if (
    !request.headers.get("content-type")?.toLowerCase().startsWith(
      "application/json",
    )
  ) {
    return jsonResponse({ error: "invalid_content_type" }, 415, origin);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > 16_384) {
    return jsonResponse({ error: "request_too_large" }, 413, origin);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }

  const submission = validateSubmission(payload);
  if (!submission) {
    return jsonResponse({ error: "invalid_rsvp" }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("RSVP storage is missing its Supabase configuration.");
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }

  let databaseResponse: Response;
  try {
    databaseResponse = await fetch(`${supabaseUrl}/rest/v1/rsvp_submissions`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        respondent_name: submission.respondentName,
        attendance: submission.attendance,
        additional_guest_names: submission.additionalGuestNames,
      }),
    });
  } catch (error) {
    console.error("RSVP database request failed.", error);
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }

  if (!databaseResponse.ok) {
    console.error(
      `RSVP database insert failed with HTTP ${databaseResponse.status}.`,
    );
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }

  return jsonResponse({ received: true }, 201, origin);
});

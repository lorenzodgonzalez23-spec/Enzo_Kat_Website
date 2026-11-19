import {
  corsHeaders,
  getAllowedOrigins,
  jsonResponse,
  originErrorResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { lookupInvitation } from "../_shared/invitations.ts";
import { exceedsGuestLimit, validateSubmission } from "./validation.ts";

const allowedOrigins = getAllowedOrigins();

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || !allowedOrigins.has(origin)) return originErrorResponse();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  const body = await readJsonBody(request);
  if (body.error) return body.error;

  const submission = validateSubmission(body.value);
  if (!submission) {
    return jsonResponse({ error: "invalid_rsvp" }, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("RSVP storage is missing its Supabase configuration.");
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }

  const lookup = await lookupInvitation(
    supabaseUrl,
    serviceRoleKey,
    submission.inviteCode,
  );
  if (lookup.kind === "unavailable") {
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }
  if (lookup.kind === "not_found") {
    return jsonResponse({ error: "invalid_invitation" }, 404, origin);
  }
  if (exceedsGuestLimit(submission, lookup.invitation.max_additional_guests)) {
    return jsonResponse({ error: "guest_limit_exceeded" }, 400, origin);
  }

  const query = new URLSearchParams({ on_conflict: "invitation_id" });
  let databaseResponse: Response;
  try {
    databaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/rsvp_submissions?${query.toString()}`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          invitation_id: lookup.invitation.id,
          respondent_name: lookup.invitation.invite_name,
          attendance: submission.attendance,
          additional_guest_names: submission.additionalGuestNames,
        }),
      },
    );
  } catch (error) {
    console.error("RSVP database request failed.", error);
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }

  if (!databaseResponse.ok) {
    console.error(
      `RSVP database upsert failed with HTTP ${databaseResponse.status}.`,
    );
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }

  return jsonResponse({ received: true }, 200, origin);
});

import {
  corsHeaders,
  getAllowedOrigins,
  jsonResponse,
  originErrorResponse,
  readJsonBody,
} from "../_shared/http.ts";
import { isInvitationCode, lookupInvitation } from "../_shared/invitations.ts";

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
  const inviteCode = (body.value as Record<string, unknown> | null)?.inviteCode;
  if (!isInvitationCode(inviteCode)) {
    return jsonResponse({ error: "invalid_invitation" }, 404, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("RSVP storage is missing its Supabase configuration.");
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }

  const result = await lookupInvitation(
    supabaseUrl,
    serviceRoleKey,
    inviteCode,
  );
  if (result.kind === "unavailable") {
    return jsonResponse({ error: "storage_unavailable" }, 503, origin);
  }
  if (result.kind === "not_found") {
    return jsonResponse({ error: "invalid_invitation" }, 404, origin);
  }

  return jsonResponse(
    {
      inviteName: result.invitation.invite_name,
      maxAdditionalGuests: result.invitation.max_additional_guests,
    },
    200,
    origin,
  );
});

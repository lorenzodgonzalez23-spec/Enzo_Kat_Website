export interface RsvpInvitation {
  id: string;
  invite_name: string;
  max_additional_guests: number;
}

export type InvitationLookup =
  | { kind: "found"; invitation: RsvpInvitation }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export function isInvitationCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function hashInvitationCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function lookupInvitation(
  supabaseUrl: string,
  serviceRoleKey: string,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<InvitationLookup> {
  const query = new URLSearchParams({
    select: "id,invite_name,max_additional_guests",
    code_hash: `eq.${await hashInvitationCode(code)}`,
    is_active: "eq.true",
    limit: "1",
  });

  let response: Response;
  try {
    response = await fetcher(
      `${supabaseUrl}/rest/v1/rsvp_invites?${query.toString()}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
  } catch (error) {
    console.error("RSVP invitation lookup request failed.", error);
    return { kind: "unavailable" };
  }

  if (!response.ok) {
    console.error(
      `RSVP invitation lookup failed with HTTP ${response.status}.`,
    );
    return { kind: "unavailable" };
  }

  let rows: unknown;
  try {
    rows = await response.json();
  } catch (error) {
    console.error("RSVP invitation lookup returned invalid JSON.", error);
    return { kind: "unavailable" };
  }

  if (!Array.isArray(rows)) {
    console.error("RSVP invitation lookup returned an unexpected response.");
    return { kind: "unavailable" };
  }

  const row = rows[0] as Partial<RsvpInvitation> | undefined;
  if (!row) return { kind: "not_found" };

  if (
    typeof row.id !== "string" ||
    typeof row.invite_name !== "string" ||
    typeof row.max_additional_guests !== "number" ||
    !Number.isInteger(row.max_additional_guests) ||
    row.max_additional_guests < 0 ||
    row.max_additional_guests > 6
  ) {
    console.error("RSVP invitation lookup returned an invalid invitation.");
    return { kind: "unavailable" };
  }

  return {
    kind: "found",
    invitation: {
      id: row.id,
      invite_name: row.invite_name,
      max_additional_guests: row.max_additional_guests,
    },
  };
}

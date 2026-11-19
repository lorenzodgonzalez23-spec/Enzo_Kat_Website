import {
  hashInvitationCode,
  isInvitationCode,
  lookupInvitation,
} from "./invitations.ts";

Deno.test("accepts only 32-byte base64url invitation codes", () => {
  if (!isInvitationCode("A".repeat(43))) {
    throw new Error("Expected a 43-character base64url code to be accepted.");
  }
  if (isInvitationCode("A".repeat(42)) || isInvitationCode("A".repeat(44))) {
    throw new Error("Expected codes of other lengths to be rejected.");
  }
  if (isInvitationCode("A".repeat(42) + "!")) {
    throw new Error("Expected non-base64url characters to be rejected.");
  }
});

Deno.test("hashes an invitation code to stable lowercase SHA-256 hex", async () => {
  const code = "A".repeat(43);
  const firstHash = await hashInvitationCode(code);
  const secondHash = await hashInvitationCode(code);

  if (!/^[0-9a-f]{64}$/.test(firstHash) || firstHash !== secondHash) {
    throw new Error("Expected a stable 64-character lowercase SHA-256 hash.");
  }
  if (firstHash === await hashInvitationCode("B".repeat(43))) {
    throw new Error(
      "Expected different invitation codes to have different hashes.",
    );
  }
});

Deno.test("looks up an active invitation by hash without sending the raw code", async () => {
  const code = "A".repeat(43);
  let requestedUrl = "";
  const result = await lookupInvitation(
    "https://example.supabase.co",
    "server-only-key",
    code,
    async (input) => {
      requestedUrl = String(input);
      return Response.json([{
        id: "invite-id",
        invite_name: "Test Family",
        max_additional_guests: 2,
      }]);
    },
  );
  const query = new URL(requestedUrl).searchParams;

  if (
    result.kind !== "found" ||
    result.invitation.invite_name !== "Test Family" ||
    result.invitation.max_additional_guests !== 2 ||
    query.get("code_hash") !== `eq.${await hashInvitationCode(code)}` ||
    query.get("is_active") !== "eq.true" ||
    requestedUrl.includes(code)
  ) {
    throw new Error(
      "Expected lookup to use the active invitation's code hash.",
    );
  }
});

Deno.test("distinguishes missing invitations from unavailable storage", async () => {
  const code = "B".repeat(43);
  const notFound = await lookupInvitation(
    "https://example.supabase.co",
    "server-only-key",
    code,
    async () => Response.json([]),
  );
  const unavailable = await lookupInvitation(
    "https://example.supabase.co",
    "server-only-key",
    code,
    async () => new Response(null, { status: 503 }),
  );

  if (notFound.kind !== "not_found" || unavailable.kind !== "unavailable") {
    throw new Error("Expected missing and unavailable results to be distinct.");
  }
});

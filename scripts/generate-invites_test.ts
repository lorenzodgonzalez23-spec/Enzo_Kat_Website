import {
  generateInviteFiles,
  parseCsv,
  parseGuestInvites,
} from "./generate-invites.ts";
import { hashInvitationCode } from "../supabase/functions/_shared/invitations.ts";

Deno.test("parses quoted CSV names, commas, and escaped quotes", () => {
  const rows = parseCsv(
    'invite_name,max_additional_guests,email\r\n"The Cruz, Family",2,\r\n"Alex ""AJ"" Cruz",0,alex@example.com\r\n',
  );

  if (
    rows.length !== 3 ||
    rows[1][0] !== "The Cruz, Family" ||
    rows[2][0] !== 'Alex "AJ" Cruz'
  ) {
    throw new Error("Expected quoted CSV cells to be parsed correctly.");
  }
});

Deno.test("validates the required invite name and guest limit columns", () => {
  const invites = parseGuestInvites(
    "invite_name,max_additional_guests,email\n" +
      "Taylor Family,3,taylor@example.com\n",
  );

  if (
    invites.length !== 1 ||
    invites[0].inviteName !== "Taylor Family" ||
    invites[0].maxAdditionalGuests !== 3
  ) {
    throw new Error("Expected the guest CSV row to be normalized.");
  }

  for (
    const invalid of [
      "invite_name,max_additional_guests\nFamily,7\n",
      "invite_name,max_additional_guests\n,1\n",
      "invite_name,max_additional_guests,email\nFamily,1,not-an-email\n",
    ]
  ) {
    let rejected = false;
    try {
      parseGuestInvites(invalid);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error("Expected invalid guest CSV to be rejected.");
    }
  }
});

Deno.test("generates distinct links and imports only code hashes", async () => {
  const generated = await generateInviteFiles(
    [
      { inviteName: "Taylor Family", maxAdditionalGuests: 2, email: "" },
      {
        inviteName: "Jordan Lee",
        maxAdditionalGuests: 0,
        email: "jordan@example.com",
      },
    ],
    "https://enzoandkat.site/",
  );
  const imports = parseCsv(generated.importCsv);
  const links = parseCsv(generated.linksCsv);
  const firstUrl = new URL(links[1][2]);
  const secondUrl = new URL(links[2][2]);
  const firstCode = new URLSearchParams(firstUrl.hash.slice(1)).get("invite");
  const secondCode = new URLSearchParams(secondUrl.hash.slice(1)).get("invite");

  if (
    imports.length !== 3 ||
    links.length !== 3 ||
    !firstCode ||
    !secondCode ||
    firstCode === secondCode ||
    generated.importCsv.includes(firstCode) ||
    generated.importCsv.includes(secondCode)
  ) {
    throw new Error("Expected separate raw links and hash-only import rows.");
  }
  if (imports[1][1] !== await hashInvitationCode(firstCode)) {
    throw new Error(
      "Expected the database import to contain the link's code hash.",
    );
  }
});

Deno.test("requires HTTPS for non-local invite links", async () => {
  let rejected = false;
  try {
    await generateInviteFiles(
      [{ inviteName: "Family", maxAdditionalGuests: 1, email: "" }],
      "http://enzoandkat.site/",
    );
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("Expected non-HTTPS invitation URLs to be rejected.");
  }
});

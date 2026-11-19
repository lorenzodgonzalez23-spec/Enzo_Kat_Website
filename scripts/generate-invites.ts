import { hashInvitationCode } from "../supabase/functions/_shared/invitations.ts";

export interface GuestInvite {
  inviteName: string;
  maxAdditionalGuests: number;
  email: string;
}

export interface GeneratedInvite {
  inviteName: string;
  maxAdditionalGuests: number;
  email: string;
  codeHash: string;
  inviteUrl: string;
}

export function parseCsv(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length !== 0) throw new Error("Unexpected quote in CSV field.");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  return rows;
}

export function parseGuestInvites(source: string): GuestInvite[] {
  const [headerRow, ...dataRows] = parseCsv(source);
  if (!headerRow) {
    throw new Error(
      "CSV must include invite_name and max_additional_guests columns.",
    );
  }

  const headers = headerRow.map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV contains duplicate column names.");
  }
  const allowedHeaders = new Set([
    "invite_name",
    "max_additional_guests",
    "email",
  ]);
  if (headers.some((header) => !allowedHeaders.has(header))) {
    throw new Error(
      "CSV may contain only invite_name, max_additional_guests, and email columns.",
    );
  }

  const nameIndex = headers.indexOf("invite_name");
  const limitIndex = headers.indexOf("max_additional_guests");
  if (nameIndex < 0 || limitIndex < 0) {
    throw new Error(
      "CSV must include invite_name and max_additional_guests columns.",
    );
  }
  const emailIndex = headers.indexOf("email");

  if (dataRows.length === 0) {
    throw new Error("CSV must include at least one invite.");
  }

  return dataRows.map((row, index) => {
    if (
      row.length > headers.length &&
      row.slice(headers.length).some((cell) => cell.trim())
    ) {
      throw new Error(`CSV row ${index + 2} has more fields than the header.`);
    }

    const inviteName = (row[nameIndex] ?? "").trim();
    if (inviteName.length === 0 || inviteName.length > 120) {
      throw new Error(
        `CSV row ${
          index + 2
        } must have an invite name between 1 and 120 characters.`,
      );
    }

    const rawLimit = (row[limitIndex] ?? "").trim();
    if (!/^[0-6]$/.test(rawLimit)) {
      throw new Error(
        `CSV row ${index + 2} must have a maximum of 0 to 6 additional guests.`,
      );
    }

    const email = emailIndex < 0 ? "" : (row[emailIndex] ?? "").trim();
    if (
      email.length > 254 ||
      (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      throw new Error(`CSV row ${index + 2} has an invalid email address.`);
    }

    return {
      inviteName,
      maxAdditionalGuests: Number(rawLimit),
      email,
    };
  });
}

function createInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: string[][]): string {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function generateInviteFiles(
  invites: GuestInvite[],
  baseUrl: string,
): Promise<{ importCsv: string; linksCsv: string }> {
  const siteUrl = new URL(baseUrl);
  if (
    siteUrl.protocol !== "https:" &&
    !(siteUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(siteUrl.hostname))
  ) {
    throw new Error(
      "The website URL must use HTTPS (or localhost for testing).",
    );
  }
  siteUrl.search = "";
  siteUrl.hash = "";

  const importRows = [[
    "invite_name",
    "code_hash",
    "max_additional_guests",
    "is_active",
  ]];
  const linkRows = [["invite_name", "email", "invite_url"]];

  for (const invite of invites) {
    const code = createInviteCode();
    const codeHash = await hashInvitationCode(code);
    const inviteUrl = new URL(siteUrl);
    inviteUrl.hash = `invite=${code}`;
    importRows.push([
      invite.inviteName,
      codeHash,
      String(invite.maxAdditionalGuests),
      "true",
    ]);
    linkRows.push([invite.inviteName, invite.email, inviteUrl.href]);
  }

  return {
    importCsv: toCsv(importRows),
    linksCsv: toCsv(linkRows),
  };
}

async function writeNewPrivateFile(
  path: string,
  contents: string,
): Promise<void> {
  await Deno.writeTextFile(path, contents, { createNew: true });
}

async function main(): Promise<void> {
  const [inputPath, requestedBaseUrl] = Deno.args;
  if (!inputPath || Deno.args.length > 2 || Deno.args.includes("--help")) {
    console.log(
      "Usage: deno run --allow-read --allow-write scripts/generate-invites.ts <guest-list.csv> [site-url]",
    );
    if (Deno.args.includes("--help")) return;
    if (!inputPath) throw new Error("Provide the path to the guest-list CSV.");
    throw new Error("Provide only a CSV path and optional website URL.");
  }

  const invites = parseGuestInvites(await Deno.readTextFile(inputPath));
  const files = await generateInviteFiles(
    invites,
    requestedBaseUrl ?? "https://enzoandkat.site/",
  );
  const importPath = "invite-import.csv";
  const linksPath = "invite-links.private.csv";

  await writeNewPrivateFile(importPath, files.importCsv);
  try {
    await writeNewPrivateFile(linksPath, files.linksCsv);
  } catch (error) {
    await Deno.remove(importPath);
    throw error;
  }

  console.log(`Generated ${invites.length} invitation records.`);
  console.log(
    `Import this hash-only file in Supabase Table Editor: ${importPath}`,
  );
  console.log(
    `Keep this links file private and send its links to guests: ${linksPath}`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Invite generation failed.",
    );
    Deno.exitCode = 1;
  }
}

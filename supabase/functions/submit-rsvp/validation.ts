import { isInvitationCode } from "../_shared/invitations.ts";

export const MAX_ADDITIONAL_GUESTS = 6;

export interface RsvpSubmission {
  inviteCode: string;
  attendance: "accepts" | "declines";
  additionalGuestNames: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSubmission(value: unknown): RsvpSubmission | null {
  if (!isRecord(value)) return null;

  const inviteCode = value.inviteCode;
  const attendance = value.attendance;
  const additionalGuestNames = value.additionalGuestNames;

  if (!isInvitationCode(inviteCode)) return null;
  if (attendance !== "accepts" && attendance !== "declines") return null;
  if (
    !Array.isArray(additionalGuestNames) ||
    additionalGuestNames.length > MAX_ADDITIONAL_GUESTS
  ) return null;

  const cleanAdditionalGuestNames: string[] = [];
  for (const name of additionalGuestNames) {
    if (typeof name !== "string") return null;
    const cleanName = name.trim();
    if (cleanName.length === 0 || cleanName.length > 120) return null;
    cleanAdditionalGuestNames.push(cleanName);
  }

  if (attendance === "declines" && cleanAdditionalGuestNames.length !== 0) {
    return null;
  }

  return {
    inviteCode,
    attendance,
    additionalGuestNames: cleanAdditionalGuestNames,
  };
}

export function exceedsGuestLimit(
  submission: RsvpSubmission,
  maxAdditionalGuests: number,
): boolean {
  return submission.additionalGuestNames.length > maxAdditionalGuests;
}

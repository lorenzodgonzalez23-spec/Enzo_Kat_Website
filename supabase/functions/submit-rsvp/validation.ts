export const MAX_ADDITIONAL_GUESTS = 6;

export interface RsvpSubmission {
  respondentName: string;
  attendance: "accepts" | "declines";
  additionalGuestNames: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSubmission(value: unknown): RsvpSubmission | null {
  if (!isRecord(value)) return null;

  const respondentName = value.respondentName;
  const attendance = value.attendance;
  const additionalGuestCount = value.additionalGuestCount;
  const additionalGuestNames = value.additionalGuestNames;

  if (typeof respondentName !== "string" || typeof attendance !== "string") {
    return null;
  }
  if (attendance !== "accepts" && attendance !== "declines") return null;
  if (
    typeof additionalGuestCount !== "number" ||
    !Number.isInteger(additionalGuestCount) ||
    additionalGuestCount < 0 || additionalGuestCount > MAX_ADDITIONAL_GUESTS
  ) return null;
  if (
    !Array.isArray(additionalGuestNames) ||
    additionalGuestNames.length !== additionalGuestCount
  ) return null;

  const cleanRespondentName = respondentName.trim();
  if (cleanRespondentName.length === 0 || cleanRespondentName.length > 120) {
    return null;
  }

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
    respondentName: cleanRespondentName,
    attendance,
    additionalGuestNames: cleanAdditionalGuestNames,
  };
}

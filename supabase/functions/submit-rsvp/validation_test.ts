import { exceedsGuestLimit, validateSubmission } from "./validation.ts";

const inviteCode = "A".repeat(43);

Deno.test("accepts a valid RSVP with six additional guests", () => {
  const guests = [
    "Guest 1",
    "Guest 2",
    "Guest 3",
    "Guest 4",
    "Guest 5",
    "Guest 6",
  ];
  const result = validateSubmission({
    inviteCode,
    attendance: "accepts",
    additionalGuestNames: guests,
  });

  if (
    !result || result.inviteCode !== inviteCode ||
    result.additionalGuestNames.length !== 6
  ) {
    throw new Error(
      "Expected the valid RSVP and all six guests to be accepted.",
    );
  }
});

Deno.test("trims submitted guest names", () => {
  const result = validateSubmission({
    inviteCode,
    attendance: "accepts",
    additionalGuestNames: ["  Guest 1  "],
  });

  if (result?.additionalGuestNames[0] !== "Guest 1") {
    throw new Error("Expected guest names to be trimmed.");
  }
});

Deno.test("rejects more than six additional guests", () => {
  const guests = Array.from({ length: 7 }, (_, index) => `Guest ${index + 1}`);
  const result = validateSubmission({
    inviteCode,
    attendance: "accepts",
    additionalGuestNames: guests,
  });

  if (result !== null) {
    throw new Error("Expected more than six additional guests to be rejected.");
  }
});

Deno.test("rejects additional guests when the respondent declines", () => {
  const result = validateSubmission({
    inviteCode,
    attendance: "declines",
    additionalGuestNames: ["Guest 1"],
  });

  if (result !== null) {
    throw new Error("Expected declined RSVPs with guests to be rejected.");
  }
});

Deno.test("rejects a malformed invite code", () => {
  const result = validateSubmission({
    inviteCode: "not-a-valid-invite",
    attendance: "accepts",
    additionalGuestNames: [],
  });

  if (result !== null) {
    throw new Error("Expected a malformed invite code to be rejected.");
  }
});

Deno.test("rejects blank additional guest names", () => {
  const result = validateSubmission({
    inviteCode,
    attendance: "accepts",
    additionalGuestNames: ["  "],
  });

  if (result !== null) {
    throw new Error("Expected a blank guest name to be rejected.");
  }
});

Deno.test("enforces the invitation-specific guest allowance", () => {
  const submission = validateSubmission({
    inviteCode,
    attendance: "accepts",
    additionalGuestNames: ["Guest 1", "Guest 2"],
  });

  if (
    !submission ||
    !exceedsGuestLimit(submission, 1) ||
    exceedsGuestLimit(submission, 2)
  ) {
    throw new Error(
      "Expected the invitation-specific guest limit to be enforced.",
    );
  }
});

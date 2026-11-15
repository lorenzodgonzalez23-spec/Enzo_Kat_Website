import { validateSubmission } from "./validation.ts";

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
    respondentName: "  Test Guest  ",
    attendance: "accepts",
    additionalGuestCount: 6,
    additionalGuestNames: guests,
  });

  if (
    !result || result.respondentName !== "Test Guest" ||
    result.additionalGuestNames.length !== 6
  ) {
    throw new Error(
      "Expected the valid RSVP and all six guests to be accepted.",
    );
  }
});

Deno.test("rejects a count that does not match the submitted guest names", () => {
  const result = validateSubmission({
    respondentName: "Test Guest",
    attendance: "accepts",
    additionalGuestCount: 2,
    additionalGuestNames: ["Guest 1"],
  });

  if (result !== null) {
    throw new Error("Expected a mismatched guest count to be rejected.");
  }
});

Deno.test("rejects more than six additional guests", () => {
  const guests = Array.from({ length: 7 }, (_, index) => `Guest ${index + 1}`);
  const result = validateSubmission({
    respondentName: "Test Guest",
    attendance: "accepts",
    additionalGuestCount: 7,
    additionalGuestNames: guests,
  });

  if (result !== null) {
    throw new Error("Expected more than six additional guests to be rejected.");
  }
});

Deno.test("rejects additional guests when the respondent declines", () => {
  const result = validateSubmission({
    respondentName: "Test Guest",
    attendance: "declines",
    additionalGuestCount: 1,
    additionalGuestNames: ["Guest 1"],
  });

  if (result !== null) {
    throw new Error("Expected declined RSVPs with guests to be rejected.");
  }
});

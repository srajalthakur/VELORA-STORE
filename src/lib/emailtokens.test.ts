import { describe, expect, it } from "vitest";
import { emailFrom, HOURS, identifierFor } from "./emailtokenids";

describe("email token identifiers", () => {
  it("round-trips an email for its own kind only", () => {
    const id = identifierFor("reset", "a@b.com");
    expect(emailFrom("reset", id)).toBe("a@b.com");
    expect(emailFrom("verify", id)).toBeNull();
    expect(emailFrom("reset", "verify:a@b.com")).toBeNull();
  });
  it("keeps colons inside the email intact", () => {
    expect(emailFrom("verify", identifierFor("verify", "we:ird@b.com"))).toBe("we:ird@b.com");
  });
  it("makes reset links short-lived", () => {
    expect(HOURS.reset).toBeLessThanOrEqual(1);
    expect(HOURS.verify).toBeGreaterThan(HOURS.reset);
  });
});

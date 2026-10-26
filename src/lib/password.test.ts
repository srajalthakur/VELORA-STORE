import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
it("hashes with a unique salt and verifies only the right password", () => {
  const h = hashPassword("correct horse");
  expect(h).not.toContain("correct horse"); expect(h).not.toBe(hashPassword("correct horse"));
  expect(verifyPassword("correct horse", h)).toBe(true); expect(verifyPassword("wrong", h)).toBe(false); expect(verifyPassword("x", "garbage")).toBe(false);
});

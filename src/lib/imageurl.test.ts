import { describe, expect, it } from "vitest";
import { isSafeImageUrl } from "./imageurl";

describe("isSafeImageUrl", () => {
  it("accepts https addresses and local public paths", () => {
    for (const ok of ["https://images.example.com/a/tote.jpg", "https://cdn.example.com/x.png?w=800", "/images/tote-noir.jpg", "/a.webp"]) expect(isSafeImageUrl(ok)).toBe(true);
  });
  it("refuses anything else", () => {
    for (const bad of ["", "http://example.com/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.example.com/a.jpg", "/../secret.jpg", "/a/../b.jpg", "https://user:pass@example.com/a.jpg", "tote.jpg", "/with space.jpg", "/back\\slash.jpg", "https://" + "a".repeat(600)]) {
      expect(isSafeImageUrl(bad)).toBe(false);
    }
  });
});

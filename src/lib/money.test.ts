import { describe, expect, it } from "vitest";
import { paiseToRupees, rupeesToPaise } from "./money";

describe("money helpers", () => {
  it("turns rupees into exact paise", () => {
    expect(rupeesToPaise("92500")).toBe(9_250_000);
    expect(rupeesToPaise("1,85,000")).toBe(18_500_000);
    expect(rupeesToPaise("1850.5")).toBe(185_050);
    expect(rupeesToPaise("19.99")).toBe(1_999);
    expect(rupeesToPaise("0.29")).toBe(29);
    expect(rupeesToPaise(" 10 ")).toBe(1_000);
  });
  it("rejects anything that is not a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e5", "12.", ".5", "1 000", "₹100"]) expect(rupeesToPaise(bad)).toBeNull();
  });
  it("shows paise as an editable amount", () => {
    expect(paiseToRupees(9_250_000)).toBe("92500");
    expect(paiseToRupees(185_050)).toBe("1850.50");
    expect(paiseToRupees(1_999)).toBe("19.99");
    expect(paiseToRupees(5)).toBe("0.05");
  });
  it("round-trips", () => {
    for (const p of [100, 101, 1_999, 18_500_000, 999_999_999]) expect(rupeesToPaise(paiseToRupees(p))).toBe(p);
  });
});

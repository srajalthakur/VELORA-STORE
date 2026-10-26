import { describe, expect, it } from "vitest";
import { passwordProblem } from "./passwordrules";

describe("passwordProblem", () => {
  it("accepts a long, varied password", () => {
    expect(passwordProblem("correct horse battery")).toBeNull();
    expect(passwordProblem("Velora#2026-ok")).toBeNull();
  });
  it("refuses short, repetitive, common and oversized passwords", () => {
    expect(passwordProblem("short1")).not.toBeNull();
    expect(passwordProblem("aaaaaaaaaaaa")).not.toBeNull();
    expect(passwordProblem("abababababab")).not.toBeNull();
    expect(passwordProblem("Password123")).not.toBeNull();
    expect(passwordProblem("x".repeat(201))).not.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { Details, savedToDetails } from "./shipto";

const good = { name: "Srajal Singh", phone: "+91 97733-06344", addr: "12 Hazratganj", city: "Lucknow", state: "Uttar Pradesh", pin: "226017" };

describe("delivery details", () => {
  it("accepts good details and cleans the phone number", () => {
    const r = Details.safeParse(good);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("9773306344");
  });
  it("refuses a bad phone, PIN or missing field", () => {
    expect(Details.safeParse({ ...good, phone: "12345" }).success).toBe(false);
    expect(Details.safeParse({ ...good, pin: "012345" }).success).toBe(false);
    expect(Details.safeParse({ ...good, city: undefined }).success).toBe(false);
  });
});

describe("savedToDetails", () => {
  const saved = { fullName: "Srajal Singh", phone: "9773306344", line1: "12 Hazratganj", line2: "Near the library", city: "Lucknow", state: "Uttar Pradesh", pin: "226017" };
  it("joins both address lines and passes the same rules as a typed address", () => {
    const d = savedToDetails(saved);
    expect(d.addr).toBe("12 Hazratganj, Near the library");
    expect(Details.safeParse(d).success).toBe(true);
  });
  it("leaves out an empty second line", () => {
    expect(savedToDetails({ ...saved, line2: null }).addr).toBe("12 Hazratganj");
    expect(savedToDetails({ ...saved, line2: "  " }).addr).toBe("12 Hazratganj");
  });
  it("is refused when the saved address is too short for an order", () => {
    expect(Details.safeParse(savedToDetails({ ...saved, line1: "A-1", line2: null })).success).toBe(false);
  });
});

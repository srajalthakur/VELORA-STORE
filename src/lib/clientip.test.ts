import { afterEach, describe, expect, it } from "vitest";
import { clientIp } from "./clientip";
const req = (xff?: string) => new Request("http://x.test/", { headers: xff ? { "x-forwarded-for": xff } : {} });
afterEach(() => { delete process.env.TRUSTED_PROXY_HOPS; });
describe("clientIp", () => {
  it("ignores the header unless proxies are trusted", () => { expect(clientIp(req("9.9.9.9"))).toBe("local"); });
  it("takes the address the nearest trusted proxy saw, not what the visitor wrote", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    expect(clientIp(req("1.2.3.4"))).toBe("1.2.3.4");
    expect(clientIp(req("6.6.6.6, 7.7.7.7, 1.2.3.4"))).toBe("1.2.3.4"); // faked entries come first
  });
  it("counts back further for two proxies, and copes with a missing header or nonsense setting", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIp(req("6.6.6.6, 1.2.3.4, 10.0.0.1"))).toBe("1.2.3.4");
    expect(clientIp(req())).toBe("unknown");
    process.env.TRUSTED_PROXY_HOPS = "abc"; expect(clientIp(req("1.2.3.4"))).toBe("local");
  });
});

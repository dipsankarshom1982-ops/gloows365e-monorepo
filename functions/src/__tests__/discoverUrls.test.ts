import { safeHttpUrl, sanitizeDiscoverResult } from "../discoverUrls";

describe("safeHttpUrl", () => {
  it("allows https URLs", () => {
    expect(safeHttpUrl("https://scholarships.gov.in/apply")).toBe("https://scholarships.gov.in/apply");
  });
  it("allows http URLs", () => {
    expect(safeHttpUrl("http://example.org/form")).toBe("http://example.org/form");
  });
  it("trims surrounding whitespace", () => {
    expect(safeHttpUrl("  https://example.org  ")).toBe("https://example.org/");
  });
  it.each([
    ["upi payment request", "upi://pay?pa=someone@upi&am=5000"],
    ["tel", "tel:+911234567890"],
    ["sms", "sms:+911234567890?body=hi"],
    ["mailto", "mailto:a@b.c"],
    ["javascript", "javascript:alert(1)"],
    ["intent", "intent://scan/#Intent;scheme=zxing;end"],
    ["app deep link", "whatsapp://send?text=hi"],
    ["data", "data:text/html,<b>x</b>"],
  ])("rejects %s URLs", (_label, url) => {
    expect(safeHttpUrl(url)).toBeNull();
  });
  it.each([
    ["malformed", "https//missing-colon"],
    ["relative path", "/apply"],
    ["no host", "https://"],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("rejects %s values", (_label, url) => {
    expect(safeHttpUrl(url)).toBeNull();
  });
  it.each([[undefined], [null], [42], [{}]])("rejects non-string %p", (v) => {
    expect(safeHttpUrl(v)).toBeNull();
  });
});

describe("sanitizeDiscoverResult", () => {
  it("keeps safe applyUrl, drops unsafe/malformed/missing ones, leaves other fields intact", () => {
    const input = {
      queryHash: "h", careerTitle: "Doctor",
      scholarshipSuggestions: [
        { name: "A", applyUrl: "https://a.example/apply" },
        { name: "B", applyUrl: "upi://pay?pa=x@upi&am=1" },
        { name: "C", applyUrl: "not a url" },
        { name: "D" },
      ],
    };
    const out = sanitizeDiscoverResult(input);
    expect(out.careerTitle).toBe("Doctor");
    expect(out.scholarshipSuggestions).toEqual([
      { name: "A", applyUrl: "https://a.example/apply" },
      { name: "B" },
      { name: "C" },
      { name: "D" },
    ]);
    expect(input.scholarshipSuggestions[1].applyUrl).toBe("upi://pay?pa=x@upi&am=1"); // input not mutated
  });
  it("returns results without scholarshipSuggestions unchanged", () => {
    const r = { queryHash: "h", careerTitle: "X" };
    expect(sanitizeDiscoverResult(r)).toBe(r);
  });
});

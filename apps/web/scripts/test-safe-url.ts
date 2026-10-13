// Regression tests for src/lib/safeUrl.ts (no test runner in apps/web — run with
//   npx tsx scripts/test-safe-url.ts
// ). Discover's scholarship applyUrl is AI-written; only http(s) links are clickable.
import { safeHttpUrl } from "../src/lib/safeUrl";

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error(`FAIL ${name}`); process.exit(1); }
  passed++; console.log(`ok   ${name}`);
}
check("https allowed", safeHttpUrl("https://scholarships.gov.in/apply") === "https://scholarships.gov.in/apply");
check("http allowed", safeHttpUrl("http://example.org/form") === "http://example.org/form");
check("whitespace trimmed", safeHttpUrl("  https://example.org  ") === "https://example.org/");
for (const [label, url] of [
  ["upi payment request", "upi://pay?pa=someone@upi&am=5000"],
  ["tel", "tel:+911234567890"],
  ["sms", "sms:+911234567890?body=hi"],
  ["mailto", "mailto:a@b.c"],
  ["javascript", "javascript:alert(1)"],
  ["intent", "intent://scan/#Intent;scheme=zxing;end"],
  ["app deep link", "whatsapp://send?text=hi"],
  ["data", "data:text/html,<b>x</b>"],
] as const) check(`${label} rejected`, safeHttpUrl(url) === null);
for (const [label, v] of [
  ["malformed", "https//missing-colon"],
  ["relative path", "/apply"],
  ["no host", "https://"],
  ["empty", ""],
  ["whitespace only", "   "],
  ["missing (undefined)", undefined],
  ["null", null],
  ["number", 42],
] as const) check(`${label} rejected`, safeHttpUrl(v) === null);
console.log(`\n${passed} passed`);

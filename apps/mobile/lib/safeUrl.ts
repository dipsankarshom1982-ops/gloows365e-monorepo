// PATH: apps/mobile/lib/safeUrl.ts
//
// Discover's scholarship `applyUrl` is written by the AI from web-search
// snippets, so it is untrusted input. Linking.openURL() opens ANY scheme on
// Android/iOS — e.g. upi://pay?... (pre-filled payment request), tel:, sms:
// or another app's deep link — so only plain web links may be opened.
// Same rule as apps/web/src/lib/safeUrl.ts and functions/src/discoverUrls.ts.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** The URL, normalised, if it is a well-formed http(s) URL with a host; otherwise null. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol) || !url.hostname) return null;
  return url.toString();
}

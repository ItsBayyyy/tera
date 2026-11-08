/**
 * True when the Supabase session cookie (`sb-<ref>-auth-token`, possibly chunked as `.0`, `.1`)
 * is present. The browser can refuse to store it, for example when the app runs inside a
 * cross-site iframe such as a device-simulator extension.
 */
export function hasAuthCookie(cookies: string): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookies);
}

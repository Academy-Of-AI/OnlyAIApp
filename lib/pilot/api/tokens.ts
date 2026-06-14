import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Personal access tokens for the Pilot API (CLI / future MCP shim).
 *
 * The plaintext token is shown to the user ONCE at mint and never stored — only
 * its sha256 hash lives in `api_tokens.token_hash`. On every call the gate hashes
 * the presented bearer and looks up the hash, so a DB read never exposes a usable
 * token. Prefix `pilot_` makes the token self-identifying (and greppable in leak
 * scanners). Server-only — never import into client code.
 */

const PREFIX = "pilot_";

export function generateToken(): { token: string; hash: string; lastFour: string } {
  const secret = randomBytes(32).toString("base64url"); // ~43 url-safe chars
  const token = `${PREFIX}${secret}`;
  return { token, hash: hashToken(token), lastFour: token.slice(-4) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/** Constant-time compare of two hex digests (defensive; lookup is by hash anyway). */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Pull a bearer token from an incoming request's Authorization header. */
export function bearerFromRequest(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = (m?.[1] ?? "").trim();
  return token.startsWith(PREFIX) ? token : null;
}

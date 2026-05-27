/**
 * Simple AES-256-GCM encryption for storing OAuth tokens in the DB.
 * Key is set via ENCRYPTION_KEY env var (base64 encoded 32-byte key).
 * Generate: openssl rand -base64 32
 */
const KEY = process.env.ENCRYPTION_KEY!;

async function getKey() {
  const raw = Buffer.from(KEY, "base64");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(combined).toString("base64");
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await getKey();
  const combined = Buffer.from(encoded, "base64");
  const iv = combined.subarray(0, 12);
  const ciphertext = combined.subarray(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

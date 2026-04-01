/**
 * Hash a session token with SHA-256 using the Web Crypto API.
 * Returns a 64-character lowercase hex string — the same format
 * produced by PostgreSQL's encode(digest(token, 'sha256'), 'hex').
 *
 * The raw token NEVER leaves the client; only the hash is stored
 * in the database. This prevents session hijacking if the DB is
 * compromised.
 */
export async function hashSessionToken(rawToken: string): Promise<string> {
  const encoded = new TextEncoder().encode(rawToken);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// supabase/functions/_shared/token-encryption.ts
// AES-256-GCM encryption for OAuth tokens at rest.
//
// Encrypted values are prefixed with "enc:" so we can detect whether a token
// has already been encrypted. This allows backward compatibility: plain-text
// tokens are returned as-is, while new writes are always encrypted.
//
// Requires env var:
//   TOKEN_ENCRYPTION_KEY — 32+ character secret used to derive the AES-256 key.
//                          Falls back to SUPABASE_SERVICE_ROLE_KEY if not set.
//
// Import with: import { encryptToken, decryptToken } from '../_shared/token-encryption.ts';

const ENCRYPTED_PREFIX = 'enc:';

// ─── Key Derivation ────────────────────────────────────────────────────────

let _cachedKey: CryptoKey | null = null;

/**
 * Derives an AES-256-GCM key from the encryption secret using HKDF.
 * The key is cached for the lifetime of the edge function invocation.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  const secret = Deno.env.get('TOKEN_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) {
    throw new Error('[ENCRYPTION] No encryption key available — set TOKEN_ENCRYPTION_KEY');
  }

  // Import raw secret as HKDF key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  );

  // Derive a 256-bit AES-GCM key with a fixed salt and info context
  _cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('vettrack-token-encryption-v1'),
      info: new TextEncoder().encode('oauth-tokens'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return _cachedKey;
}

// ─── Encrypt ───────────────────────────────────────────────────────────────

/**
 * Encrypts a plain-text token using AES-256-GCM.
 *
 * Returns a string prefixed with "enc:" followed by base64-encoded
 * IV (12 bytes) + ciphertext + auth tag.
 *
 * Returns null if the input is null/undefined (tokens can be null on disconnect).
 */
export async function encryptToken(plaintext: string | null | undefined): Promise<string | null> {
  if (plaintext == null || plaintext === '') return null;

  // Already encrypted — don't double-encrypt
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext;

  const key = await getEncryptionKey();

  // 12-byte random IV (NIST recommendation for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  // Combine IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined));
}

// ─── Decrypt ───────────────────────────────────────────────────────────────

/**
 * Decrypts an encrypted token.
 *
 * If the value does NOT start with "enc:", it's assumed to be a plain-text
 * token from before the migration — returned as-is for backward compatibility.
 *
 * Returns null if the input is null/undefined.
 */
export async function decryptToken(value: string | null | undefined): Promise<string | null> {
  if (value == null || value === '') return null;

  // Not encrypted — backward compatibility for pre-migration tokens
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const key = await getEncryptionKey();

  // Strip prefix and decode base64
  const encoded = value.slice(ENCRYPTED_PREFIX.length);
  const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));

  // Extract IV (first 12 bytes) and ciphertext (rest)
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuffer);
}

// ─── Utilities ─────────────────────────────────────────────────────────────

/** Returns true if the value appears to be an encrypted token. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypts both access_token and refresh_token in an object.
 * Convenience wrapper for use in upsert/update payloads.
 */
export async function encryptTokenPair(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined,
): Promise<{ access_token: string | null; refresh_token: string | null }> {
  const [encAccess, encRefresh] = await Promise.all([
    encryptToken(accessToken),
    encryptToken(refreshToken),
  ]);
  return { access_token: encAccess, refresh_token: encRefresh };
}

/**
 * Decrypts both access_token and refresh_token from an integration record.
 * Convenience wrapper for use after reading from the database.
 */
export async function decryptTokenPair(
  integration: { access_token?: string | null; refresh_token?: string | null },
): Promise<{ access_token: string | null; refresh_token: string | null }> {
  const [decAccess, decRefresh] = await Promise.all([
    decryptToken(integration.access_token),
    decryptToken(integration.refresh_token),
  ]);
  return { access_token: decAccess, refresh_token: decRefresh };
}

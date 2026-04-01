-- ============================================================================
-- MIGRATION: Secure Session Token Storage
-- ============================================================================
-- Replaces plain-text session_token with a SHA-256 hash so that a database
-- breach never exposes raw tokens that could be used for session hijacking.
--
-- BEST PRACTICE — Token Hashing Strategy:
--
--   The session token is a client-side secret. The workflow is:
--
--     1. Client generates or obtains the raw token (e.g. last 16 chars
--        of the Supabase access_token).
--     2. Client hashes it BEFORE sending to the database:
--          const hash = await crypto.subtle.digest(
--            'SHA-256',
--            new TextEncoder().encode(rawToken)
--          );
--          const hex = Array.from(new Uint8Array(hash))
--            .map(b => b.toString(16).padStart(2, '0')).join('');
--     3. Client sends only the hex-encoded hash to Supabase.
--     4. Database stores and indexes the hash — never the raw token.
--     5. Lookups (upsert conflict, neq filter) compare hash-to-hash.
--
--   Why SHA-256?
--     • One-way: the raw token cannot be recovered from the hash.
--     • Deterministic: same token always produces the same hash,
--       so upsert/conflict resolution still works.
--     • Fast enough for session lookups; no need for bcrypt/scrypt
--       since session tokens have high entropy (not user passwords).
--     • 64-char hex string — fixed length, easy to index.
--
--   Why NOT bcrypt/argon2?
--     • Session tokens are high-entropy random strings, not low-entropy
--       passwords. Brute-force is infeasible regardless of hash speed.
--     • bcrypt output includes a random salt, making it non-deterministic.
--       You could NOT do WHERE session_token_hash = crypt(input, hash)
--       without fetching every row first. SHA-256 allows direct lookups.
--
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Add the new hash column (text, fixed 64-char hex)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE user_sessions
  ADD COLUMN session_token_hash text;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Migrate existing plain-text tokens → SHA-256 hex hashes
-- ════════════════════════════════════════════════════════════════════════════
-- pgcrypto's digest() produces a bytea SHA-256; encode() converts to hex.

UPDATE user_sessions
SET session_token_hash = encode(digest(session_token, 'sha256'), 'hex')
WHERE session_token IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Drop the old plain-text column and its unique index
-- ════════════════════════════════════════════════════════════════════════════
-- The unique index user_sessions_session_token_key is dropped automatically
-- when the column is dropped.

ALTER TABLE user_sessions
  DROP COLUMN session_token;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Add constraints on the hash column
-- ════════════════════════════════════════════════════════════════════════════
-- • NOT NULL: every session must have a token hash.
-- • CHECK: enforces exactly 64 hex characters (SHA-256 output).
-- • UNIQUE: preserves upsert conflict resolution behaviour.

ALTER TABLE user_sessions
  ALTER COLUMN session_token_hash SET NOT NULL;

ALTER TABLE user_sessions
  ADD CONSTRAINT chk_session_token_hash_format
    CHECK (session_token_hash ~ '^[a-f0-9]{64}$');

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Create unique index for lookup performance + upsert conflict
-- ════════════════════════════════════════════════════════════════════════════
-- B-tree on the 64-char hex hash. Used by:
--   • upsert(..., { onConflict: 'session_token_hash' })
--   • .neq('session_token_hash', hash) for "mark others as not current"
--   • Any future session validation lookups

CREATE UNIQUE INDEX idx_user_sessions_token_hash
  ON user_sessions (session_token_hash);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Composite index: user_id + token hash (common query pattern)
-- ════════════════════════════════════════════════════════════════════════════
-- Covers the query: WHERE user_id = $1 AND session_token_hash != $2

CREATE INDEX idx_user_sessions_user_token
  ON user_sessions (user_id, session_token_hash);

COMMIT;

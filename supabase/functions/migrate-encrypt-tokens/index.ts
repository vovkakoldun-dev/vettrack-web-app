// supabase/functions/migrate-encrypt-tokens/index.ts
// One-time migration: encrypts existing plain-text OAuth tokens in email_integrations.
//
// Run after deploying the 20260403_encrypt_email_tokens migration:
//
//   curl -X POST \
//     "https://<project>.supabase.co/functions/v1/migrate-encrypt-tokens" \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
//
// Processes rows in batches. Safe to run multiple times (idempotent).
// Only accessible with the service role key (not anon/authenticated).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { encryptToken, isEncrypted } from '../_shared/token-encryption.ts';

const BATCH_SIZE = 50;

serve(async (req: Request) => {
  // Only allow service role access
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!authHeader?.includes(serviceRoleKey)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden — requires service role key' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
  );

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process in batches
  while (true) {
    const { data: rows, error: fetchError } = await supabase
      .from('email_integrations')
      .select('id, access_token, refresh_token')
      .eq('tokens_encrypted', false)
      .not('access_token', 'is', null)
      .limit(BATCH_SIZE);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch rows: ${fetchError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      try {
        // Skip if already encrypted (shouldn't happen with the query filter, but safe)
        const accessAlreadyEncrypted = isEncrypted(row.access_token);
        const refreshAlreadyEncrypted = isEncrypted(row.refresh_token);

        if (accessAlreadyEncrypted && (refreshAlreadyEncrypted || !row.refresh_token)) {
          totalSkipped++;
          // Mark as encrypted even though it already was
          await supabase
            .from('email_integrations')
            .update({ tokens_encrypted: true })
            .eq('id', row.id);
          continue;
        }

        const encryptedAccess = accessAlreadyEncrypted
          ? row.access_token
          : await encryptToken(row.access_token);

        const encryptedRefresh = refreshAlreadyEncrypted || !row.refresh_token
          ? row.refresh_token
          : await encryptToken(row.refresh_token);

        const { error: updateError } = await supabase
          .from('email_integrations')
          .update({
            access_token: encryptedAccess,
            refresh_token: encryptedRefresh,
            tokens_encrypted: true,
          })
          .eq('id', row.id);

        if (updateError) {
          console.error(`[MIGRATE] Failed to update row ${row.id}: ${updateError.message}`);
          totalErrors++;
        } else {
          totalProcessed++;
        }
      } catch (err) {
        console.error(`[MIGRATE] Error encrypting row ${row.id}:`, err);
        totalErrors++;
      }
    }
  }

  // Also mark rows with null tokens (disconnected) as encrypted
  const { count: nullCount } = await supabase
    .from('email_integrations')
    .update({ tokens_encrypted: true })
    .is('access_token', null)
    .eq('tokens_encrypted', false)
    .select('id', { count: 'exact', head: true });

  return new Response(
    JSON.stringify({
      success: true,
      encrypted: totalProcessed,
      skipped: totalSkipped,
      null_tokens_marked: nullCount || 0,
      errors: totalErrors,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});

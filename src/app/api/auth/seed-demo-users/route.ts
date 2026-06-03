import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { DEMO_USERS } from '@/lib/demoUsers';
import { isDemoMode, requireSeedAccess, authError } from '@/lib/apiAuth';
// @ts-ignore
import pg from 'pg';

// POST — Idempotent seed of all 18 demo users.
// Uses direct PostgreSQL access via POSTGRES_URL (same approach as
// scripts/seed-demo-users.mjs) so it works without SUPABASE_SERVICE_ROLE_KEY.
export async function POST(request: NextRequest) {
  // SECURITY: in production this requires Super Admin or a valid SEED_SECRET.
  // In demo mode it is open so a fresh demo DB can be bootstrapped.
  if (!isDemoMode()) {
    try {
      await requireSeedAccess(request);
    } catch (err) {
      const authResp = authError(err);
      if (authResp) return authResp;
      throw err;
    }
  }

  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    return NextResponse.json(
      {
        success: false,
        error: 'POSTGRES_URL is not configured on the server.',
        hint: 'Add POSTGRES_URL to your .env file. Get it from Supabase Dashboard → Project Settings → Database → Connection string (URI).',
      },
      { status: 500 }
    );
  }

  const PgClient = pg.default?.Client || pg.Client;
  const pgClient = new PgClient({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pgClient.connect();
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to connect to database: ${err.message}`,
        hint: 'Check that POSTGRES_URL is correct and the database is reachable.',
      },
      { status: 500 }
    );
  }

  const result = { created: 0, updated: 0, errors: [] as string[] };

  for (const user of DEMO_USERS) {
    await pgClient.query('BEGIN');
    try {
      const checkRes = await pgClient.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [user.email]
      );

      let userId: string;
      const rawUserMetadata: Record<string, any> = {
        role: user.role,
        tier: user.tier,
        email: user.email,
        full_name: user.full_name,
        email_verified: true,
        phone_verified: false,
      };

      if (checkRes.rows.length > 0) {
        // ── Existing auth user: refresh password + metadata ──
        userId = checkRes.rows[0].id;
        rawUserMetadata.sub = userId;

        await pgClient.query(
          `UPDATE auth.users
           SET encrypted_password          = crypt($1, gen_salt('bf', 10)),
               raw_user_meta_data          = $2,
               email_confirmed_at          = COALESCE(email_confirmed_at, NOW()),
               -- Supabase auth requires empty-string, not NULL, for these token columns
               confirmation_token          = COALESCE(NULLIF(confirmation_token,''), ''),
               recovery_token              = COALESCE(recovery_token, ''),
               email_change_token_new      = COALESCE(email_change_token_new, ''),
               email_change                = COALESCE(email_change, ''),
               email_change_token_current  = COALESCE(email_change_token_current, ''),
               reauthentication_token      = COALESCE(reauthentication_token, ''),
               updated_at                  = NOW()
           WHERE id = $3`,
          [user.password, JSON.stringify(rawUserMetadata), userId]
        );

        await pgClient.query(
          `UPDATE auth.identities
           SET identity_data = $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [JSON.stringify(rawUserMetadata), userId]
        );
        result.updated++;
      } else {
        // ── New auth user ──
        userId = crypto.randomUUID();
        rawUserMetadata.sub = userId;

        await pgClient.query(
          `INSERT INTO auth.users (
             instance_id, id, aud, role, email, encrypted_password,
             email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
             is_super_admin, created_at, updated_at, is_sso_user, is_anonymous,
             confirmation_token, recovery_token, email_change_token_new,
             email_change, email_change_token_current, reauthentication_token,
             phone_change, phone_change_token
           )
           VALUES (
             '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
             crypt($3, gen_salt('bf', 10)), NOW(),
             '{"provider":"email","providers":["email"]}', $4,
             false, NOW(), NOW(), false, false,
             '', '', '', '', '', '', '', ''
           )`,
          [userId, user.email, user.password, JSON.stringify(rawUserMetadata)]
        );

        const identityId = crypto.randomUUID();
        await pgClient.query(
          `INSERT INTO auth.identities (
             id, user_id, identity_data, provider, provider_id,
             email, last_sign_in_at, created_at, updated_at
           )
           VALUES ($1, $2, $3, 'email', $4, $5, NOW(), NOW(), NOW())`,
          [identityId, userId, JSON.stringify(rawUserMetadata), userId, user.email]
        );
        result.created++;
      }

      // ── Upsert public.users profile ──
      await pgClient.query(
        `INSERT INTO public.users (id, email, full_name, role, tier, department, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (email)
         DO UPDATE SET
           id = EXCLUDED.id,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           tier = EXCLUDED.tier,
           department = EXCLUDED.department,
           updated_at = NOW()`,
        [userId, user.email, user.full_name, user.role, user.tier, user.department]
      );

      await pgClient.query('COMMIT');
    } catch (err: any) {
      try { await pgClient.query('ROLLBACK'); } catch {}
      result.errors.push(`${user.email}: ${err.message}`);
    }
  }

  await pgClient.end().catch(() => {});

  const success = result.created + result.updated > 0;
  return NextResponse.json(
    {
      success,
      ...result,
      total: DEMO_USERS.length,
      message: success
        ? `Seeded ${result.created} new + updated ${result.updated} existing demo user(s).`
        : 'Seeding failed. See errors.',
    },
    { status: success ? 200 : 500 }
  );
}

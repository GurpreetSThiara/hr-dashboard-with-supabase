import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { DEMO_SUPER_OWNER } from '@/lib/demoSuperOwner';
import { isDemoMode } from '@/lib/auth';
// @ts-ignore
import pg from 'pg';

/**
 * POST /api/auth/seed-demo-user — idempotently create the demo Super Owner in
 * auth.users + public.users (organization_id stays NULL = platform account).
 * Only available in demo mode.
 */
export async function POST(_request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Demo seeding is disabled in production' }, { status: 403 });
  }

  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    return NextResponse.json(
      { success: false, error: 'POSTGRES_URL is not configured on the server.' },
      { status: 500 }
    );
  }

  const PgClient = pg.default?.Client || pg.Client;
  const client = new PgClient({ connectionString: postgresUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Failed to connect to database: ${err.message}` },
      { status: 500 }
    );
  }

  const u = DEMO_SUPER_OWNER;
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT id FROM auth.users WHERE email = $1', [u.email]);
    let userId: string;
    const meta: Record<string, any> = {
      role: u.role, tier: u.tier, email: u.email, full_name: u.full_name,
      email_verified: true, phone_verified: false,
    };

    if (check.rows.length > 0) {
      userId = check.rows[0].id;
      meta.sub = userId;
      await client.query(
        `UPDATE auth.users
           SET encrypted_password         = crypt($1, gen_salt('bf', 10)),
               raw_user_meta_data         = $2,
               email_confirmed_at         = COALESCE(email_confirmed_at, NOW()),
               confirmation_token         = COALESCE(NULLIF(confirmation_token,''), ''),
               recovery_token             = COALESCE(recovery_token, ''),
               email_change_token_new     = COALESCE(email_change_token_new, ''),
               email_change               = COALESCE(email_change, ''),
               email_change_token_current = COALESCE(email_change_token_current, ''),
               reauthentication_token     = COALESCE(reauthentication_token, ''),
               updated_at                 = NOW()
         WHERE id = $3`,
        [u.password, JSON.stringify(meta), userId]
      );
      await client.query(
        `UPDATE auth.identities SET identity_data = $1, updated_at = NOW() WHERE user_id = $2`,
        [JSON.stringify(meta), userId]
      );
    } else {
      userId = crypto.randomUUID();
      meta.sub = userId;
      await client.query(
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
        [userId, u.email, u.password, JSON.stringify(meta)]
      );
      const identityId = crypto.randomUUID();
      // NOTE: auth.identities.email is a GENERATED column (derived from
      // identity_data->>'email') in current Supabase — do NOT insert it.
      await client.query(
        `INSERT INTO auth.identities (
           id, user_id, identity_data, provider, provider_id,
           last_sign_in_at, created_at, updated_at
         ) VALUES ($1, $2, $3, 'email', $4, NOW(), NOW(), NOW())`,
        [identityId, userId, JSON.stringify(meta), userId]
      );
    }

    // public.users profile — organization_id intentionally left NULL (platform).
    await client.query(
      `INSERT INTO public.users (id, email, full_name, role, tier, organization_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NULL, NOW(), NOW())
       ON CONFLICT (email)
       DO UPDATE SET id = EXCLUDED.id, full_name = EXCLUDED.full_name,
                     role = EXCLUDED.role, tier = EXCLUDED.tier,
                     organization_id = NULL, updated_at = NOW()`,
      [userId, u.email, u.full_name, u.role, u.tier]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, email: u.email });
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch {}
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}

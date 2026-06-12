import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/organizations/[id]/provision-admin — create (or reset) an Org Admin
 * login for an organization. Body: { email, password, fullName? }.
 * Creates the auth user + public.users row (role 'Admin', tier 3) scoped to the org.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperOwner(request);
    const { id: organizationId } = await params;
    const b = await request.json();
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const fullName = String(b.fullName ?? '').trim() || email.split('@')[0];
    if (!email || !password) return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 });

    const result = await withPgClient(async (client) => {
      const org = await client.query(`SELECT id FROM organizations WHERE id = $1`, [organizationId]);
      if (!org.rows[0]) throw Object.assign(new Error('Organization not found'), { status: 404 });

      await client.query('BEGIN');
      try {
        const existing = await client.query(`SELECT id FROM auth.users WHERE email = $1`, [email]);
        let userId: string;
        const meta = { role: 'Admin', tier: 3, email, full_name: fullName, email_verified: true, phone_verified: false } as any;

        if (existing.rows[0]) {
          userId = existing.rows[0].id;
          meta.sub = userId;
          await client.query(
            `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf',10)),
               raw_user_meta_data = $2, email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
               confirmation_token = COALESCE(NULLIF(confirmation_token,''), ''), updated_at = NOW()
             WHERE id = $3`,
            [password, JSON.stringify(meta), userId]
          );
        } else {
          userId = crypto.randomUUID();
          meta.sub = userId;
          await client.query(
            `INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
               raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,is_sso_user,is_anonymous,
               confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,
               reauthentication_token,phone_change,phone_change_token)
             VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,
               crypt($3,gen_salt('bf',10)),NOW(),'{"provider":"email","providers":["email"]}',$4,
               false,NOW(),NOW(),false,false,'','','','','','','','')`,
            [userId, email, password, JSON.stringify(meta)]
          );
          await client.query(
            `INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
             VALUES ($1,$2,$3,'email',$4,NOW(),NOW(),NOW())`,
            [crypto.randomUUID(), userId, JSON.stringify(meta), userId]
          );
        }

        await client.query(
          `INSERT INTO public.users (id,email,full_name,role,tier,organization_id,created_at,updated_at)
           VALUES ($1,$2,$3,'Admin',3,$4,NOW(),NOW())
           ON CONFLICT (email) DO UPDATE SET id=EXCLUDED.id, full_name=EXCLUDED.full_name,
             role='Admin', tier=3, organization_id=$4, updated_at=NOW()`,
          [userId, email, fullName, organizationId]
        );

        await logAudit(client, actor.email, 'organization.provision_admin', 'organization', organizationId, { email });
        await client.query('COMMIT');
        return { email, userId };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: error.status ?? 400 });
  }
}

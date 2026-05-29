import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

const ROLE_TIER_MAP: Record<string, number> = {
  'Super Admin': 1, 'Owner': 2, 'Admin': 3, 'HR Admin': 4, 'HR Manager': 5,
  'HR Executive': 6, 'Recruiter': 7, 'Payroll Manager': 8, 'Finance': 9,
  'Compliance': 10, 'IT Ops': 11, 'Director': 12, 'Manager': 13,
  'Team Lead': 14, 'Employee': 15, 'Contractor': 16, 'Intern': 17, 'Read-Only User': 18,
};

async function getPgClient() {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) return null;
  let pg: any;
  try {
    // @ts-ignore
    pg = await import('pg');
  } catch {
    return null;
  }
  const PgClient = pg.default?.Client || pg.Client;
  const client = new PgClient({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

// PUT — update a user's role (by Super Admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { newRole, requesterId, requesterTier } = body as {
      newRole: string;
      requesterId: string;
      requesterTier: number;
    };

    if (!newRole || !ROLE_TIER_MAP[newRole]) {
      return NextResponse.json({ error: 'Invalid role name' }, { status: 400 });
    }

    const newTier = ROLE_TIER_MAP[newRole];

    if (id === requesterId) {
      return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 422 });
    }

    const conn = getServerSupabase();

    // ── Path 1: service role available ───────────────────────────────────────
    if (conn?.hasServiceRole) {
      const supabase = conn.client;

      const { data: targetUser, error: fetchError } = await supabase
        .from('users')
        .select('tier, role, email')
        .eq('id', id)
        .single();

      if (fetchError || !targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const guardError = checkPrivilegeGuards(targetUser, requesterTier, newRole, newTier);
      if (guardError) return guardError;

      if (targetUser.tier === 1 && newTier > 1) {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('tier', 1);
        if ((count || 0) <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last Super Admin. Assign another Super Admin first.' },
            { status: 422 }
          );
        }
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ role: newRole, tier: newTier })
        .eq('id', id);
      if (updateError) throw updateError;

      // Best-effort auth metadata update
      try {
        await supabase.auth.admin.updateUserById(id, {
          user_metadata: { role: newRole, tier: newTier },
        });
      } catch {}

      // Log activity (fire-and-forget)
      try {
        await supabase.from('activity_feed').insert([{
          icon: 'UserCircleIcon',
          icon_color: 'text-blue-600',
          icon_bg: 'bg-blue-100',
          description: `Role changed for ${targetUser.email}: ${targetUser.role} → ${newRole}`,
        }]);
      } catch {}

      return NextResponse.json({ success: true, newRole, newTier });
    }

    // ── Path 2: no service role — use POSTGRES_URL directly ─────────────────
    const pgClient = await getPgClient();
    if (!pgClient) {
      return NextResponse.json(
        { error: 'Database is not configured. Set POSTGRES_URL or SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 503 }
      );
    }

    try {
      const targetRes = await pgClient.query(
        'SELECT tier, role, email FROM public.users WHERE id = $1',
        [id]
      );
      if (targetRes.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const targetUser = targetRes.rows[0];
      const guardError = checkPrivilegeGuards(targetUser, requesterTier, newRole, newTier);
      if (guardError) return guardError;

      if (targetUser.tier === 1 && newTier > 1) {
        const countRes = await pgClient.query(
          'SELECT COUNT(*) FROM public.users WHERE tier = 1'
        );
        if (parseInt(countRes.rows[0].count) <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last Super Admin. Assign another Super Admin first.' },
            { status: 422 }
          );
        }
      }

      await pgClient.query(
        'UPDATE public.users SET role = $1, tier = $2, updated_at = NOW() WHERE id = $3',
        [newRole, newTier, id]
      );

      return NextResponse.json({ success: true, newRole, newTier });
    } finally {
      await pgClient.end().catch(() => {});
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — deactivate a user (sets role to Read-Only User / tier 18)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { requesterId, requesterTier } = body as { requesterId: string; requesterTier: number };

    if (id === requesterId) {
      return NextResponse.json({ error: 'You cannot deactivate yourself.' }, { status: 422 });
    }

    const conn = getServerSupabase();

    // ── Path 1: service role available ───────────────────────────────────────
    if (conn?.hasServiceRole) {
      const supabase = conn.client;

      const { data: targetUser } = await supabase
        .from('users')
        .select('tier, role')
        .eq('id', id)
        .single();

      if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      if (targetUser.tier < requesterTier) {
        return NextResponse.json(
          { error: 'Cannot deactivate a user with higher privileges.' },
          { status: 403 }
        );
      }

      // Disable in Supabase auth (best-effort)
      try {
        await supabase.auth.admin.updateUserById(id, { ban_duration: '876600h' });
      } catch {}

      return NextResponse.json({ success: true });
    }

    // ── Path 2: no service role — use POSTGRES_URL directly ─────────────────
    const pgClient = await getPgClient();
    if (!pgClient) {
      return NextResponse.json(
        { error: 'Database is not configured. Set POSTGRES_URL or SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 503 }
      );
    }

    try {
      const targetRes = await pgClient.query(
        'SELECT tier, role FROM public.users WHERE id = $1',
        [id]
      );
      if (targetRes.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const targetUser = targetRes.rows[0];
      if (targetUser.tier < requesterTier) {
        return NextResponse.json(
          { error: 'Cannot deactivate a user with higher privileges.' },
          { status: 403 }
        );
      }

      // Mark user as deactivated by setting role to Read-Only User
      await pgClient.query(
        "UPDATE public.users SET role = 'Read-Only User', tier = 18, updated_at = NOW() WHERE id = $1",
        [id]
      );

      return NextResponse.json({ success: true });
    } finally {
      await pgClient.end().catch(() => {});
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function checkPrivilegeGuards(
  targetUser: { tier: number; role: string },
  requesterTier: number,
  newRole: string,
  newTier: number
): NextResponse | null {
  if (targetUser.tier < requesterTier) {
    return NextResponse.json(
      { error: `You cannot modify a ${targetUser.role} (higher privilege than your role).` },
      { status: 403 }
    );
  }
  if (newTier < requesterTier) {
    return NextResponse.json(
      { error: `You cannot assign the "${newRole}" role — it has higher privileges than your current role.` },
      { status: 403 }
    );
  }
  return null;
}

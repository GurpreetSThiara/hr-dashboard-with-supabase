import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

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

// GET — return all users with role info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tierFilter = searchParams.get('tier');

    const conn = getServerSupabase();

    // ── Path 1: service role available — use Supabase client ────────────────
    if (conn?.hasServiceRole) {
      const supabase = conn.client;
      let query = supabase
        .from('users')
        .select('id, email, full_name, role, tier, department, location, created_at')
        .order('tier', { ascending: true })
        .order('email', { ascending: true });

      if (tierFilter) query = query.eq('tier', parseInt(tierFilter));

      const { data, error } = await query;
      if (error) throw error;

      const users = data || [];
      return NextResponse.json({
        users: applySearch(users, search),
        counts: buildCounts(users),
      });
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
      let queryText =
        'SELECT id, email, full_name, role, tier, department, location, created_at FROM public.users';
      const values: any[] = [];

      if (tierFilter) {
        queryText += ' WHERE tier = $1';
        values.push(parseInt(tierFilter));
      }

      queryText += ' ORDER BY tier ASC, email ASC';

      const res = await pgClient.query(queryText, values);
      const users = res.rows;

      return NextResponse.json({
        users: applySearch(users, search),
        counts: buildCounts(users),
      });
    } finally {
      await pgClient.end().catch(() => {});
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function applySearch(users: any[], search: string) {
  if (!search) return users;
  const q = search.toLowerCase();
  return users.filter(
    u =>
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
  );
}

function buildCounts(users: any[]) {
  return {
    total: users.length,
    privileged: users.filter(u => u.tier <= 2).length,
    hrManagement: users.filter(u => u.tier >= 3 && u.tier <= 13).length,
    staff: users.filter(u => u.tier >= 14).length,
  };
}

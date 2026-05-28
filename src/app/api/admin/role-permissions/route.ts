import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, envMisconfiguredError } from '@/lib/supabase/server';

const TIER_TO_ROLE: Record<number, string> = {
  1: 'Super Admin', 2: 'Owner', 3: 'Admin', 4: 'HR Admin', 5: 'HR Manager',
  6: 'HR Executive', 7: 'Recruiter', 8: 'Payroll Manager', 9: 'Finance',
  10: 'Compliance', 11: 'IT Ops', 12: 'Director', 13: 'Manager',
  14: 'Team Lead', 15: 'Employee', 16: 'Contractor', 17: 'Intern', 18: 'Read-Only User',
};

const DEFAULT_PERMISSIONS: Record<string, number[]> = {
  view_dashboard:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  view_employees:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_employees: [1,2,3,4,5,6,7],
  view_leaves:      [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  approve_leaves:   [1,2,3,4,5,6,12,13],
  manage_policies:  [1,2],
  view_attendance:  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_attendance:[1,2,3,4,5],
  view_hierarchy:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_hierarchy: [1,2,3,4],
  admin_panel:      [1,2],
};

// GET — returns current permission matrix (DB or defaults if never saved)
export async function GET() {
  try {
    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ matrix: DEFAULT_PERMISSIONS, isDefault: true });
    }

    const { data, error } = await conn.client
      .from('role_permissions')
      .select('permission, tier')
      .eq('allowed', true);

    if (error || !data || data.length === 0) {
      return NextResponse.json({ matrix: DEFAULT_PERMISSIONS, isDefault: true });
    }

    const matrix: Record<string, number[]> = {};
    data.forEach((row: any) => {
      if (!matrix[row.permission]) matrix[row.permission] = [];
      matrix[row.permission].push(row.tier);
    });

    // Ensure all permission keys exist (even if currently empty)
    Object.keys(DEFAULT_PERMISSIONS).forEach(p => {
      if (!matrix[p]) matrix[p] = [];
    });

    return NextResponse.json({ matrix, isDefault: false });
  } catch {
    return NextResponse.json({ matrix: DEFAULT_PERMISSIONS, isDefault: true });
  }
}

// POST — batch-save the full permission matrix
export async function POST(request: NextRequest) {
  try {
    const conn = getServerSupabase();
    if (!conn || !conn.hasServiceRole) {
      return NextResponse.json(
        envMisconfiguredError('Saving permissions requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS.'),
        { status: 503 }
      );
    }
    const supabase = conn.client;
    const { data: { session } } = await supabase.auth.getSession();

    const body = await request.json();
    const { matrix, updatedBy } = body as {
      matrix: Record<string, number[]>;
      updatedBy: string;
    };

    if (!matrix || typeof matrix !== 'object') {
      return NextResponse.json({ error: 'Invalid matrix payload' }, { status: 400 });
    }

    // ── Edge-case guards ─────────────────────────────────────────────────────
    // 1. Super Admin (tier 1) MUST retain admin_panel
    if (!(matrix['admin_panel'] || []).includes(1)) {
      return NextResponse.json(
        { error: 'Cannot remove admin_panel from Super Admin (tier 1). This would lock all admins out.' },
        { status: 422 }
      );
    }
    // 2. Super Admin must retain view_dashboard
    if (!(matrix['view_dashboard'] || []).includes(1)) {
      return NextResponse.json(
        { error: 'Cannot remove view_dashboard from Super Admin.' },
        { status: 422 }
      );
    }
    // 3. All permissions must be known keys
    const validPerms = Object.keys(DEFAULT_PERMISSIONS);
    const unknownPerms = Object.keys(matrix).filter(p => !validPerms.includes(p));
    if (unknownPerms.length > 0) {
      return NextResponse.json(
        { error: `Unknown permissions: ${unknownPerms.join(', ')}` },
        { status: 400 }
      );
    }
    // 4. All tiers must be 1–18
    for (const tiers of Object.values(matrix)) {
      for (const t of tiers) {
        if (t < 1 || t > 18 || !Number.isInteger(t)) {
          return NextResponse.json({ error: `Invalid tier value: ${t}` }, { status: 400 });
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const now = new Date().toISOString();

    // Build all rows to upsert
    const rows: any[] = [];
    for (const [permission, tiers] of Object.entries(matrix)) {
      const tierSet = new Set(tiers as number[]);
      for (let t = 1; t <= 18; t++) {
        rows.push({
          permission,
          tier: t,
          role_name: TIER_TO_ROLE[t],
          allowed: tierSet.has(t),
          updated_by: updatedBy || session?.user?.email || 'system',
          updated_at: now,
        });
      }
    }

    // Upsert all rows (replaces existing on permission+tier conflict)
    const { error: upsertError } = await supabase
      .from('role_permissions')
      .upsert(rows, { onConflict: 'permission,tier' });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, savedAt: now });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

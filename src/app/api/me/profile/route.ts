import { NextRequest, NextResponse } from 'next/server';
import { withTenantPgClient } from '@/lib/pgClient';
import { requireAuth, requireWritable, authError } from '@/lib/apiAuth';

const EDITABLE = ['phone', 'address', 'emergency_contact', 'bio', 'date_of_birth'] as const;

/** GET /api/me/profile — the caller's own employee record (self-service view). */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    if (!actor.organizationId) return NextResponse.json(null);
    const row = await withTenantPgClient(actor.organizationId, async (client) => {
      const res = await client.query(
        `SELECT id, emp_id, first_name, last_name, email, department, designation,
                phone, address, emergency_contact, bio, date_of_birth, join_date
           FROM employees WHERE organization_id = $1 AND LOWER(email) = $2 LIMIT 1`,
        [actor.organizationId, actor.email]
      );
      return res.rows[0] ?? null;
    });
    return NextResponse.json(row);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** PATCH /api/me/profile — update the caller's OWN contact fields only. */
export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireWritable(request);
    if (!actor.organizationId) return NextResponse.json({ error: 'No organization' }, { status: 403 });
    const body = await request.json();
    const sets: string[] = [];
    const vals: any[] = [];
    for (const c of EDITABLE) {
      if (c in body) { vals.push(body[c] === '' ? null : body[c]); sets.push(`${c} = $${vals.length}`); }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const updated = await withTenantPgClient(actor.organizationId, async (client) => {
      vals.push(actor.organizationId); const orgP = `$${vals.length}`;
      vals.push(actor.email); const emailP = `$${vals.length}`;
      const res = await client.query(
        `UPDATE employees SET ${sets.join(', ')}, updated_at = NOW()
          WHERE organization_id = ${orgP} AND LOWER(email) = ${emailP} RETURNING id`, vals);
      return res.rows[0];
    });
    if (!updated) return NextResponse.json({ error: 'No employee record linked to your account' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

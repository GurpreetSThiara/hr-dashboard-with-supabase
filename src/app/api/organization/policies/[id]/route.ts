/**
 * PUT    /api/organization/policies/[id] — update a policy (manage_policies).
 *        A material change to content/title bumps `version`, which invalidates
 *        prior acknowledgements (employees must re-acknowledge).
 * DELETE /api/organization/policies/[id] — archive (soft) a policy.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireManagePolicies, authError, ApiAuthError } from '@/lib/apiAuth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManagePolicies(request);
    const { id } = await params;
    const body = await request.json();
    const { title, category, content, effective_date, expiry_date, requires_acknowledgement } = body;

    const row = await withPgClient(async (client) => {
      const existing = await client.query('SELECT * FROM org_policies WHERE id = $1', [id]);
      if (existing.rows.length === 0) throw new ApiAuthError('Policy not found', 404);
      const before = existing.rows[0];

      // Bump version when title or content materially changes → re-ack required.
      const materialChange =
        (title !== undefined && title !== before.title) ||
        (content !== undefined && content !== before.content);
      const newVersion = materialChange ? before.version + 1 : before.version;

      const res = await client.query(
        `UPDATE org_policies
         SET title       = COALESCE($1, title),
             category    = COALESCE($2, category),
             content     = COALESCE($3, content),
             effective_date = COALESCE($4, effective_date),
             expiry_date    = $5,
             requires_acknowledgement = COALESCE($6, requires_acknowledgement),
             version     = $7,
             updated_at  = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          title ?? null, category ?? null, content ?? null,
          effective_date ?? null, expiry_date ?? null,
          requires_acknowledgement ?? null, newVersion, id,
        ]
      );
      return res.rows[0];
    });

    return NextResponse.json({ policy: row });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManagePolicies(request);
    const { id } = await params;
    await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE org_policies SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [id]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Policy not found', 404);
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

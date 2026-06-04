/**
 * Manage shares on a record.
 *   GET    list shares
 *   POST   { principal_type, principal_id, access_level }  — grant/update
 *   DELETE { share_id }  — revoke
 *
 * Only someone with FULL access on the record (owner / admin / full-share) may
 * manage its shares. Audited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError, ApiAuthError } from '@/lib/apiAuth';
import { getActorPrincipals, resolveRecordAccess, meets, ACCESS_LEVELS } from '@/lib/recordSharing';
import { logAdminAction } from '@/lib/adminAudit';

async function loadRecord(client: any, apiName: string, recordId: string) {
  const o = await client.query(`SELECT id FROM custom_objects WHERE api_name = $1 AND is_archived = false LIMIT 1`, [apiName]);
  if (o.rows.length === 0) throw new ApiAuthError('Object not found', 404);
  const rec = await client.query(`SELECT * FROM custom_records WHERE id = $1 AND object_id = $2 AND deleted_at IS NULL`, [recordId, o.rows[0].id]);
  if (rec.rows.length === 0) throw new ApiAuthError('Record not found', 404);
  return { objectId: o.rows[0].id, record: rec.rows[0] };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; recordId: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName, recordId } = await params;
    const data = await withPgClient(async (client) => {
      const { record } = await loadRecord(client, apiName, recordId);
      const principals = await getActorPrincipals(client, actor);
      const level = await resolveRecordAccess(client, principals, record);
      if (!meets(level, 'full')) throw new ApiAuthError('Forbidden — only record owners can view sharing', 403);
      const shares = await client.query(
        `SELECT id, principal_type, principal_id, access_level, granted_by, created_at
         FROM record_shares WHERE record_id = $1 ORDER BY created_at DESC`,
        [recordId]
      );
      return { shares: shares.rows, accessLevels: ACCESS_LEVELS };
    });
    return NextResponse.json(data);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; recordId: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName, recordId } = await params;
    const { principal_type, principal_id, access_level } = await request.json();

    if (!['user', 'role', 'role_group', 'department'].includes(principal_type) || !principal_id?.trim()) {
      return NextResponse.json({ error: 'principal_type and principal_id are required' }, { status: 400 });
    }
    if (!ACCESS_LEVELS.includes(access_level)) {
      return NextResponse.json({ error: `access_level must be one of: ${ACCESS_LEVELS.join(', ')}` }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const { objectId, record } = await loadRecord(client, apiName, recordId);
      const principals = await getActorPrincipals(client, actor);
      const level = await resolveRecordAccess(client, principals, record);
      if (!meets(level, 'full')) throw new ApiAuthError('Forbidden — only record owners can manage sharing', 403);

      const res = await client.query(
        `INSERT INTO record_shares (object_id, record_id, principal_type, principal_id, access_level, granted_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (record_id, principal_type, principal_id) DO UPDATE
           SET access_level = EXCLUDED.access_level, granted_by = EXCLUDED.granted_by
         RETURNING *`,
        [objectId, recordId, principal_type, principal_id.trim(), access_level, actor.email]
      );
      logAdminAction({
        actor, action: 'record.share', entityType: 'custom_record', entityId: recordId,
        summary: `Shared record with ${principal_type} ${principal_id} (${access_level})`, newValue: res.rows[0], request,
      });
      return res.rows[0];
    });
    return NextResponse.json({ share: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; recordId: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName, recordId } = await params;
    const { share_id } = await request.json();
    if (!share_id) return NextResponse.json({ error: 'share_id is required' }, { status: 400 });

    await withPgClient(async (client) => {
      const { record } = await loadRecord(client, apiName, recordId);
      const principals = await getActorPrincipals(client, actor);
      const level = await resolveRecordAccess(client, principals, record);
      if (!meets(level, 'full')) throw new ApiAuthError('Forbidden — only record owners can manage sharing', 403);
      const res = await client.query(`DELETE FROM record_shares WHERE id = $1 AND record_id = $2 RETURNING *`, [share_id, recordId]);
      if (res.rows.length === 0) throw new ApiAuthError('Share not found', 404);
      logAdminAction({
        actor, action: 'record.unshare', entityType: 'custom_record', entityId: recordId,
        summary: `Removed share ${res.rows[0].principal_type} ${res.rows[0].principal_id}`, oldValue: res.rows[0], request,
      });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Field-Level Security (FLS) for custom-object records.
 *
 * Model (deterministic, deny-once-restricted):
 *   - Admin (tier ≤ 2)                  → every field view + edit.
 *   - A field with NO field_permissions  → open (view + edit) to anyone with
 *     the corresponding record access.
 *   - A field WITH permission rows        → restricted: a principal may view
 *     only if a matching row grants can_view, and edit only if can_edit.
 *
 * FLS is principal-based (user / role / role_group / department) and applies
 * regardless of record ownership — matching enterprise FLS semantics.
 */
import type { ActorPrincipals } from '@/lib/recordSharing';

export interface FieldPermRow {
  field_id: string;
  principal_type: string;
  principal_id: string;
  can_view: boolean;
  can_edit: boolean;
}

export interface FieldAccess {
  viewable: Set<string>; // field api_names the actor can view
  editable: Set<string>; // field api_names the actor can edit
}

function principalMatches(p: ActorPrincipals, row: FieldPermRow): boolean {
  switch (row.principal_type) {
    case 'user':       return row.principal_id.toLowerCase() === p.email;
    case 'role':       return row.principal_id === p.role;
    case 'role_group': return p.groupIds.includes(row.principal_id);
    case 'department': return !!p.department && row.principal_id === p.department;
    default: return false;
  }
}

/**
 * Resolve which fields (by api_name) the actor can view / edit.
 * @param fields   the object's field definitions ({ id, api_name })
 */
export async function resolveFieldAccess(
  client: any,
  principals: ActorPrincipals,
  objectId: string,
  fields: { id: string; api_name: string }[]
): Promise<FieldAccess> {
  const viewable = new Set<string>();
  const editable = new Set<string>();

  if (principals.isAdmin) {
    fields.forEach((f) => { viewable.add(f.api_name); editable.add(f.api_name); });
    return { viewable, editable };
  }

  const res = await client.query(
    `SELECT field_id, principal_type, principal_id, can_view, can_edit
     FROM field_permissions WHERE object_id = $1`,
    [objectId]
  );
  const byField = new Map<string, FieldPermRow[]>();
  for (const r of res.rows as FieldPermRow[]) {
    (byField.get(r.field_id) || byField.set(r.field_id, []).get(r.field_id)!).push(r);
  }

  for (const f of fields) {
    const rows = byField.get(f.id);
    if (!rows || rows.length === 0) {
      // Unrestricted field → open
      viewable.add(f.api_name);
      editable.add(f.api_name);
      continue;
    }
    let canView = false, canEdit = false;
    for (const row of rows) {
      if (principalMatches(principals, row)) {
        if (row.can_view) canView = true;
        if (row.can_edit) canEdit = true;
      }
    }
    if (canView) viewable.add(f.api_name);
    if (canEdit) editable.add(f.api_name);
  }

  return { viewable, editable };
}

/** Strip field values the actor cannot view from a record's data map. */
export function maskRecordData(data: Record<string, any>, access: FieldAccess): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(data || {})) {
    if (access.viewable.has(k)) out[k] = data[k];
  }
  return out;
}

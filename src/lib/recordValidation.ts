/**
 * Validates + coerces a dynamic record's data against its object's field
 * definitions. Driven entirely by metadata (custom_fields), so no per-object
 * code is required. Performs type checks, required/picklist checks, unique
 * checks, and lookup-integrity checks (the last two need the DB, hence `client`).
 */

export interface FieldDef {
  id: string;
  api_name: string;
  label: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  picklist_values: string[] | null;
  lookup_object_id: string | null;
  is_archived: boolean;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  clean: Record<string, any>;
}

/**
 * @param client    pg client (for unique + lookup checks)
 * @param objectId  the custom_objects id (for unique scoping)
 * @param fields    the object's field definitions
 * @param input     the submitted data map (api_name → value)
 * @param recordId  the record being updated (excluded from unique checks)
 */
export async function validateRecord(
  client: any,
  objectId: string,
  fields: FieldDef[],
  input: Record<string, any>,
  recordId?: string
): Promise<ValidationResult> {
  const errors: Record<string, string> = {};
  const clean: Record<string, any> = {};

  for (const f of fields) {
    if (f.is_archived) continue;
    if (f.field_type === 'formula') continue; // computed, not user-writable

    let v = input[f.api_name];
    const provided = v !== undefined && v !== null && v !== '';

    if (!provided) {
      if (f.is_required) errors[f.api_name] = `${f.label} is required`;
      continue;
    }

    switch (f.field_type) {
      case 'text':
      case 'richtext':
      case 'phone':
      case 'file':
        v = String(v);
        break;
      case 'number':
      case 'currency':
      case 'percent': {
        const n = Number(v);
        if (!Number.isFinite(n)) { errors[f.api_name] = `${f.label} must be a number`; continue; }
        v = n;
        break;
      }
      case 'boolean':
        v = v === true || v === 'true' || v === 1 || v === '1';
        break;
      case 'email':
        v = String(v);
        if (!EMAIL_RE.test(v)) { errors[f.api_name] = `${f.label} must be a valid email`; continue; }
        break;
      case 'url':
        v = String(v);
        if (!/^https?:\/\//i.test(v)) { errors[f.api_name] = `${f.label} must be a URL (http/https)`; continue; }
        break;
      case 'date':
      case 'datetime':
        if (isNaN(Date.parse(String(v)))) { errors[f.api_name] = `${f.label} must be a valid date`; continue; }
        v = String(v);
        break;
      case 'picklist':
        if (!(f.picklist_values || []).includes(String(v))) {
          errors[f.api_name] = `${f.label} must be one of: ${(f.picklist_values || []).join(', ')}`; continue;
        }
        v = String(v);
        break;
      case 'multipicklist': {
        const arr = Array.isArray(v) ? v.map(String) : [String(v)];
        const allowed = new Set(f.picklist_values || []);
        const bad = arr.filter((x) => !allowed.has(x));
        if (bad.length) { errors[f.api_name] = `${f.label}: invalid option(s) ${bad.join(', ')}`; continue; }
        v = arr;
        break;
      }
      case 'lookup': {
        const exists = await lookupExists(client, f.lookup_object_id, String(v));
        if (!exists) { errors[f.api_name] = `${f.label}: referenced record not found`; continue; }
        v = String(v);
        break;
      }
      case 'multilookup': {
        const arr = Array.isArray(v) ? v.map(String) : [String(v)];
        for (const rid of arr) {
          if (!(await lookupExists(client, f.lookup_object_id, rid))) {
            errors[f.api_name] = `${f.label}: referenced record ${rid} not found`; break;
          }
        }
        if (errors[f.api_name]) continue;
        v = arr;
        break;
      }
      default:
        v = String(v);
    }

    // Unique check (scoped to the object, excluding the current record)
    if (f.is_unique) {
      const dup = await client.query(
        `SELECT 1 FROM custom_records
         WHERE object_id = $1 AND deleted_at IS NULL
           AND data->>$2 = $3 ${recordId ? 'AND id <> $4' : ''}
         LIMIT 1`,
        recordId ? [objectId, f.api_name, String(v), recordId] : [objectId, f.api_name, String(v)]
      );
      if (dup.rows.length) { errors[f.api_name] = `${f.label} must be unique (value already exists)`; continue; }
    }

    clean[f.api_name] = v;
  }

  return { ok: Object.keys(errors).length === 0, errors, clean };
}

async function lookupExists(client: any, targetObjectId: string | null, recordId: string): Promise<boolean> {
  if (!targetObjectId) return false;
  const r = await client.query(
    `SELECT 1 FROM custom_records WHERE id = $1 AND object_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [recordId, targetObjectId]
  );
  return r.rows.length > 0;
}

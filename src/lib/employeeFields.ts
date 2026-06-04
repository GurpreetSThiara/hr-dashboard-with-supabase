/**
 * Field-level security for the employees table.
 *
 * Classifies employee columns into PUBLIC (visible to any authenticated
 * employee via the directory) and SENSITIVE (visible only to the record owner,
 * the person's reporting manager for limited fields, or HR/Admin).
 *
 * The schema today only has `salary_band` as a sensitive column, but this
 * module is the single place to extend as private fields (bank details, gov
 * IDs, personal contact, etc.) are added — so enforcement stays centralized
 * and backend-authoritative.
 */
import type { AuthedActor } from '@/lib/apiAuth';

/** Columns any authenticated employee may see (Employee Directory surface). */
export const PUBLIC_EMPLOYEE_FIELDS = [
  'id',
  'emp_id',
  'first_name',
  'last_name',
  'email',            // company email
  'designation',
  'department',
  'employment_type',
  'manager',
  'location',
  'status',
  'join_date',
  'attendance_pct',   // shown as a coarse badge; not the raw attendance log
] as const;

/** Columns that must never be returned to non-authorized roles. */
export const SENSITIVE_EMPLOYEE_FIELDS = [
  'salary_band',
  // Future private fields land here and are protected automatically:
  // 'bank_account', 'tax_id', 'personal_email', 'personal_phone',
  // 'home_address', 'government_id', 'passport_no', 'medical_info',
  // 'emergency_contact', 'background_check',
] as const;

/** Internal/bookkeeping columns never exposed through the directory. */
const INTERNAL_FIELDS = ['deleted_at', 'deleted_by', 'deleted_reason'];

export type EmployeeRow = Record<string, any>;

export interface FieldContext {
  /** The viewer is the employee whose record this is. */
  isSelf: boolean;
  /** The viewer is the reporting manager of this employee. */
  isManager: boolean;
}

/** HR/Admin roles that may see every field on every employee. */
export function isHrFieldViewer(actor: AuthedActor): boolean {
  // tier ≤ 6 = Super Admin … HR Executive. Payroll/Finance handled separately.
  return actor.tier <= 6;
}

/** Finance/Payroll may see compensation fields but not other private HR data. */
export function isCompensationViewer(actor: AuthedActor): boolean {
  return ['Payroll Manager', 'Finance'].includes(actor.role);
}

/**
 * Return a copy of an employee row containing only the fields the actor is
 * permitted to see.
 *
 * - HR/Admin (tier ≤ 6): full record.
 * - Self: full record (own data, including own compensation band).
 * - Finance/Payroll: public fields + compensation fields.
 * - Manager of this employee: public fields (team management view).
 * - Everyone else: public fields only.
 */
export function filterEmployeeForActor(
  row: EmployeeRow,
  actor: AuthedActor,
  ctx: FieldContext
): EmployeeRow {
  if (!row) return row;

  // Full access: HR/Admin or the record owner.
  if (isHrFieldViewer(actor) || ctx.isSelf) {
    const { ...rest } = row;
    // Still hide internal soft-delete bookkeeping from non-HR self-views.
    if (!isHrFieldViewer(actor)) INTERNAL_FIELDS.forEach((f) => delete rest[f]);
    return rest;
  }

  // Build the allowed set: public always; compensation for Finance/Payroll.
  const allowed = new Set<string>(PUBLIC_EMPLOYEE_FIELDS as readonly string[]);
  if (isCompensationViewer(actor)) {
    allowed.add('salary_band');
  }

  const out: EmployeeRow = {};
  for (const key of Object.keys(row)) {
    if (allowed.has(key)) out[key] = row[key];
  }
  return out;
}

/** Filter a list of employee rows. */
export function filterEmployeeList(
  rows: EmployeeRow[],
  actor: AuthedActor,
  ctxFor: (row: EmployeeRow) => FieldContext
): EmployeeRow[] {
  return rows.map((r) => filterEmployeeForActor(r, actor, ctxFor(r)));
}

/** The SELECT column list for the public directory (parameterized-safe identifiers). */
export const PUBLIC_DIRECTORY_COLUMNS = PUBLIC_EMPLOYEE_FIELDS.join(', ');

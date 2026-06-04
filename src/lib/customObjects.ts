/**
 * Shared constants + validation for the dynamic-object metadata engine.
 */
export const FIELD_TYPES = [
  'text', 'number', 'currency', 'percent', 'date', 'datetime', 'email', 'phone',
  'url', 'picklist', 'multipicklist', 'boolean', 'formula', 'richtext', 'file',
  'lookup', 'multilookup',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Types that require picklist_values. */
export const PICKLIST_TYPES: FieldType[] = ['picklist', 'multipicklist'];
/** Types that require a lookup_object_id. */
export const LOOKUP_TYPES: FieldType[] = ['lookup', 'multilookup'];

/** api_name must be a lowercase snake_case identifier. */
export function isValidApiName(name: string): boolean {
  return /^[a-z][a-z0-9_]{0,62}$/.test(name);
}

/** Normalize a label into a candidate api_name. */
export function toApiName(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63) || 'field';
}

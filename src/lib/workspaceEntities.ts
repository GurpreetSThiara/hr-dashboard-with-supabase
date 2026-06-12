/**
 * Server-side registry for tenant "workspace" entities. Every table and column
 * here is an explicit allowlist — the dynamic CRUD routes never accept a table
 * name or column from the client, only an entity KEY that maps to this config.
 * This keeps the generic API injection-safe and tenant-isolated.
 */
export interface EntityConfig {
  table: string;
  /** Columns the client may set on create/update. */
  columns: string[];
  /** Columns that are JSON/JSONB (value gets JSON.stringify'd). */
  jsonColumns?: string[];
  /** ORDER BY clause (trusted, from this file only). */
  orderBy?: string;
  /** If set, this column is auto-filled with the actor's email on create. */
  actorEmailColumn?: string;
  /** If set, list/mutations are restricted to rows where this column = actor email. */
  ownerColumn?: string;
}

export const ENTITIES: Record<string, EntityConfig> = {
  announcements: { table: 'company_announcements', columns: ['title', 'body', 'pinned'], actorEmailColumn: 'author_email', orderBy: 'pinned DESC, created_at DESC' },
  recognition:   { table: 'recognition', columns: ['to_employee_id', 'message', 'badge'], actorEmailColumn: 'from_email', orderBy: 'created_at DESC' },
  events:        { table: 'company_events', columns: ['title', 'description', 'event_date', 'location'], actorEmailColumn: 'created_by', orderBy: 'event_date ASC' },
  surveys:       { table: 'surveys', columns: ['title', 'options', 'is_open'], jsonColumns: ['options'], actorEmailColumn: 'created_by', orderBy: 'created_at DESC' },
  tickets:       { table: 'hr_tickets', columns: ['subject', 'body', 'category', 'priority', 'status'], actorEmailColumn: 'requester_email', orderBy: 'created_at DESC' },
  notifications: { table: 'hr_notifications', columns: ['user_email', 'title', 'body', 'is_read'], ownerColumn: 'user_email', orderBy: 'created_at DESC' },
  todos:         { table: 'personal_tasks', columns: ['title', 'is_done', 'due_date'], actorEmailColumn: 'user_email', ownerColumn: 'user_email', orderBy: 'is_done ASC, created_at DESC' },
  documents:     { table: 'employee_documents', columns: ['employee_id', 'name', 'category', 'url'], actorEmailColumn: 'uploaded_by', orderBy: 'created_at DESC' },
  assets:        { table: 'assets', columns: ['name', 'tag', 'category', 'status', 'assigned_to_employee_id'], orderBy: 'created_at DESC' },
  expenses:      { table: 'expense_claims', columns: ['employee_id', 'title', 'amount', 'currency', 'category', 'status', 'notes'], actorEmailColumn: 'employee_email', orderBy: 'created_at DESC' },
  goals:         { table: 'goals', columns: ['employee_id', 'title', 'description', 'progress', 'status', 'due_date'], orderBy: 'created_at DESC' },
  training:      { table: 'training_records', columns: ['employee_id', 'course', 'provider', 'completed_on', 'expires_on', 'status'], orderBy: 'created_at DESC' },
  onboarding:    { table: 'onboarding_tasks', columns: ['employee_id', 'title', 'is_done', 'due_date'], orderBy: 'is_done ASC, created_at DESC' },
  skills:        { table: 'employee_skills', columns: ['employee_id', 'skill', 'level'], orderBy: 'skill ASC' },
  exits:         { table: 'exit_requests', columns: ['employee_id', 'reason', 'last_working_day', 'status'], orderBy: 'created_at DESC' },

  // ── HR v2 modules ──────────────────────────────────────────────────────────
  departments:   { table: 'departments', columns: ['name', 'head_email', 'description'], orderBy: 'name ASC' },
  locations:     { table: 'locations', columns: ['name', 'city', 'country', 'timezone'], orderBy: 'name ASC' },
  designations:  { table: 'designations', columns: ['title', 'level', 'department'], orderBy: 'title ASC' },
  job_openings:  { table: 'job_openings', columns: ['title', 'department', 'location', 'employment_type', 'status', 'openings', 'description'], orderBy: 'created_at DESC' },
  candidates:    { table: 'candidates', columns: ['name', 'email', 'phone', 'job_opening_id', 'stage', 'source', 'notes'], orderBy: 'created_at DESC' },
  interviews:    { table: 'interviews', columns: ['candidate_id', 'interviewer_email', 'scheduled_at', 'mode', 'status', 'feedback'], orderBy: 'scheduled_at DESC' },
  shifts:        { table: 'shifts', columns: ['name', 'start_time', 'end_time', 'days', 'employee_id'], orderBy: 'created_at DESC' },
  travel:        { table: 'travel_requests', columns: ['employee_id', 'destination', 'purpose', 'start_date', 'end_date', 'estimated_cost', 'status'], actorEmailColumn: 'requester_email', orderBy: 'created_at DESC' },
  advances:      { table: 'advance_requests', columns: ['employee_id', 'amount', 'currency', 'reason', 'status'], actorEmailColumn: 'requester_email', orderBy: 'created_at DESC' },
  grievances:    { table: 'grievances', columns: ['category', 'subject', 'details', 'status', 'confidential'], actorEmailColumn: 'raised_by', orderBy: 'created_at DESC' },
  suggestions:   { table: 'suggestions', columns: ['title', 'details', 'votes', 'status'], actorEmailColumn: 'submitted_by', orderBy: 'votes DESC, created_at DESC' },
  kb:            { table: 'kb_articles', columns: ['title', 'category', 'body', 'published'], orderBy: 'created_at DESC' },
  handbook:      { table: 'handbook_policies', columns: ['title', 'category', 'body', 'version', 'effective_date'], orderBy: 'created_at DESC' },
  incidents:     { table: 'safety_incidents', columns: ['location', 'severity', 'description', 'status', 'incident_date'], actorEmailColumn: 'reported_by', orderBy: 'created_at DESC' },
  vendors:       { table: 'vendors', columns: ['name', 'category', 'contact_email', 'phone', 'status'], orderBy: 'name ASC' },
  referrals:     { table: 'referrals', columns: ['candidate_name', 'candidate_email', 'position', 'status'], actorEmailColumn: 'referrer_email', orderBy: 'created_at DESC' },
};

export function getEntity(key: string): EntityConfig | null {
  return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : null;
}

/**
 * Time Tracking module — schema + standard-object catalog registration.
 *
 * Creates native tables (clients, projects, tasks, time_entries, timesheets,
 * billing_rates) with FKs + indexes, enables RLS (authenticated-read, matching
 * the rest of the app — all writes go through service-role API routes), and
 * registers the new entities in the standard_objects catalog so they appear in
 * the admin Data Model UI.
 *
 * Idempotent: safe to re-run. Run with: node scripts/time-tracking-migration.js
 * (requires POSTGRES_URL in the environment).
 */
const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();

  // ── clients ────────────────────────────────────────────────────────────────
  await c.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name        text NOT NULL,
      code        text,
      status      text NOT NULL DEFAULT 'active',
      color       text,
      notes       text,
      created_by  text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `);

  // ── projects ─────────────────────────────────────────────────────────────────
  await c.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name             text NOT NULL,
      code             text,
      client_id        uuid REFERENCES clients(id) ON DELETE SET NULL,
      status           text NOT NULL DEFAULT 'active',
      color            text,
      is_billable      boolean NOT NULL DEFAULT true,
      billing_rate     numeric(12,2),
      estimated_hours  numeric(10,2),
      budget_amount    numeric(14,2),
      department       text,
      created_by       text,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id)`);

  // ── tasks ──────────────────────────────────────────────────────────────────
  await c.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name             text NOT NULL,
      status           text NOT NULL DEFAULT 'open',
      is_billable      boolean NOT NULL DEFAULT true,
      billing_rate     numeric(12,2),
      estimated_hours  numeric(10,2),
      assignee_email   text,
      created_by       text,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);

  // ── timesheets ───────────────────────────────────────────────────────────────
  // One per (employee, period_type, period_start). States: draft / submitted /
  // approved / rejected / returned.
  await c.query(`
    CREATE TABLE IF NOT EXISTS timesheets (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id      uuid REFERENCES employees(id) ON DELETE CASCADE,
      employee_email   text NOT NULL,
      period_type      text NOT NULL DEFAULT 'weekly',
      period_start     date NOT NULL,
      period_end       date NOT NULL,
      status           text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','submitted','approved','rejected','returned')),
      total_minutes    integer NOT NULL DEFAULT 0,
      billable_minutes integer NOT NULL DEFAULT 0,
      submitted_at     timestamptz,
      approved_by      text,
      approved_at      timestamptz,
      reviewer_comment text,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now(),
      UNIQUE (employee_id, period_type, period_start)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_timesheets_emp ON timesheets(employee_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status)`);

  // ── time_entries ─────────────────────────────────────────────────────────────
  // duration_minutes is the source of truth for reporting; for a running timer
  // ended_at is NULL and is_running = true. paused_accumulated_seconds tracks
  // elapsed time banked across pause/resume cycles.
  await c.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id     uuid REFERENCES employees(id) ON DELETE SET NULL,
      employee_email  text NOT NULL,
      client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
      project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
      task_id         uuid REFERENCES tasks(id) ON DELETE SET NULL,
      timesheet_id    uuid REFERENCES timesheets(id) ON DELETE SET NULL,
      activity_type   text,
      description     text,
      tags            text[],
      department      text,
      cost_center     text,
      is_billable     boolean NOT NULL DEFAULT true,
      billing_rate    numeric(12,2),
      billable_amount numeric(14,2),
      source          text NOT NULL DEFAULT 'timer',
      started_at      timestamptz NOT NULL DEFAULT now(),
      ended_at        timestamptz,
      duration_minutes integer NOT NULL DEFAULT 0,
      is_running      boolean NOT NULL DEFAULT false,
      is_paused       boolean NOT NULL DEFAULT false,
      paused_at       timestamptz,
      paused_accumulated_seconds integer NOT NULL DEFAULT 0,
      created_by      text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_te_emp ON time_entries(employee_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_te_email ON time_entries(lower(employee_email))`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_te_project ON time_entries(project_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_te_task ON time_entries(task_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_te_timesheet ON time_entries(timesheet_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_te_started ON time_entries(started_at)`);
  // At most one running timer per employee.
  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_te_running_per_emp
    ON time_entries(employee_id) WHERE is_running = true
  `);

  // ── billing_rates ─────────────────────────────────────────────────────────────
  // scope: project | task | employee | global. scope_id NULL for global.
  await c.query(`
    CREATE TABLE IF NOT EXISTS billing_rates (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      scope          text NOT NULL CHECK (scope IN ('project','task','employee','global')),
      scope_id       text,
      rate           numeric(12,2) NOT NULL,
      currency       text NOT NULL DEFAULT 'USD',
      effective_from date NOT NULL DEFAULT CURRENT_DATE,
      created_by     text,
      created_at     timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_billing_scope ON billing_rates(scope, scope_id)`);

  // ── RLS (authenticated read; writes via service-role API routes) ─────────────
  const tables = ['clients', 'projects', 'tasks', 'timesheets', 'time_entries', 'billing_rates'];
  for (const t of tables) {
    await c.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await c.query(`DROP POLICY IF EXISTS ${t}_read ON ${t}`);
    await c.query(`CREATE POLICY ${t}_read ON ${t} FOR SELECT TO authenticated USING (true)`);
  }
  console.log('✓ time-tracking tables + indexes + RLS');

  // ── Register in standard_objects catalog (best-effort) ───────────────────────
  const hasCatalog = await c.query(`SELECT to_regclass('public.standard_objects') AS t`);
  if (hasCatalog.rows[0].t) {
    const objects = [
      ['client', 'Client', 'Clients', 'clients', 'Billing clients for time tracking', 'BriefcaseIcon'],
      ['project', 'Project', 'Projects', 'projects', 'Projects time is tracked against', 'FolderIcon'],
      ['task', 'Task', 'Tasks', 'tasks', 'Tasks within projects', 'CheckCircleIcon'],
      ['time_entry', 'Time Entry', 'Time Entries', 'time_entries', 'Tracked work time', 'ClockIcon'],
      ['timesheet', 'Timesheet', 'Timesheets', 'timesheets', 'Periodic timesheets for approval', 'TableCellsIcon'],
    ];
    for (const [api, label, plural, table, desc, icon] of objects) {
      await c.query(
        `INSERT INTO standard_objects (api_name,label,plural_label,table_name,description,icon)
         SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM standard_objects WHERE api_name=$1)`,
        [api, label, plural, table, desc, icon]
      );
    }

    const fields = [
      ['client','name','Name','text',false,null],
      ['client','code','Code','text',false,null],
      ['client','status','Status','picklist',false,null],
      ['project','name','Name','text',false,null],
      ['project','code','Code','text',false,null],
      ['project','client_id','Client','lookup',true,'client'],
      ['project','status','Status','picklist',false,null],
      ['project','is_billable','Billable','boolean',false,null],
      ['project','billing_rate','Billing Rate','currency',false,null],
      ['project','estimated_hours','Estimated Hours','number',false,null],
      ['project','budget_amount','Budget','currency',false,null],
      ['task','project_id','Project','lookup',true,'project'],
      ['task','name','Name','text',false,null],
      ['task','status','Status','picklist',false,null],
      ['task','is_billable','Billable','boolean',false,null],
      ['task','estimated_hours','Estimated Hours','number',false,null],
      ['time_entry','employee_id','Employee','lookup',true,'employee'],
      ['time_entry','project_id','Project','lookup',true,'project'],
      ['time_entry','task_id','Task','lookup',true,'task'],
      ['time_entry','client_id','Client','lookup',true,'client'],
      ['time_entry','activity_type','Activity Type','picklist',false,null],
      ['time_entry','description','Description','text',false,null],
      ['time_entry','is_billable','Billable','boolean',false,null],
      ['time_entry','duration_minutes','Duration (min)','number',false,null],
      ['time_entry','started_at','Start','datetime',false,null],
      ['time_entry','ended_at','End','datetime',false,null],
      ['timesheet','employee_id','Employee','lookup',true,'employee'],
      ['timesheet','period_type','Period Type','picklist',false,null],
      ['timesheet','period_start','Period Start','date',false,null],
      ['timesheet','period_end','Period End','date',false,null],
      ['timesheet','status','Status','picklist',false,null],
      ['timesheet','total_minutes','Total (min)','number',false,null],
      ['timesheet','billable_minutes','Billable (min)','number',false,null],
    ];
    let seeded = 0;
    for (const [obj, api, label, type, isRel, rel] of fields) {
      const r = await c.query(
        `INSERT INTO standard_object_fields (object_api_name,api_name,label,data_type,is_relationship,related_object,is_custom,is_visible)
         SELECT $1,$2,$3,$4,$5,$6,false,true
         WHERE NOT EXISTS (SELECT 1 FROM standard_object_fields WHERE object_api_name=$1 AND api_name=$2)`,
        [obj, api, label, type, isRel, rel]
      );
      seeded += r.rowCount;
    }
    console.log(`✓ registered 5 standard objects + ${seeded} catalog fields`);
  } else {
    console.log('• standard_objects catalog not found — skipping registration');
  }

  await c.end();
}
run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

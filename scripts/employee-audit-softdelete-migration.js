const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  console.log('Connected.\n');

  // ── Employee audit log ────────────────────────────────────────────────────
  await c.query(`
    CREATE TABLE IF NOT EXISTS employee_audit_log (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id   uuid REFERENCES employees(id) ON DELETE SET NULL,
      employee_emp_id text,                 -- denormalized so audit survives deletion
      actor_email   text,
      actor_role    text,
      action        text NOT NULL,          -- created/updated/deleted/restored/role_change/salary_change/department_change/manager_change/status_change
      changed_fields text[],
      old_values    jsonb,
      new_values    jsonb,
      reason        text,
      ip_address    text,
      user_agent    text,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_emp_audit_employee ON employee_audit_log(employee_id, created_at DESC)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_emp_audit_actor ON employee_audit_log(actor_email, created_at DESC)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_emp_audit_action ON employee_audit_log(action)`);
  console.log('✓ employee_audit_log table + indexes');

  // RLS: enabled, no client policies → only server (withPgClient) can access
  await c.query(`ALTER TABLE employee_audit_log ENABLE ROW LEVEL SECURITY`);
  console.log('✓ employee_audit_log RLS enabled (server-only access)');

  // ── Soft-delete columns on employees ───────────────────────────────────────
  await c.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
  await c.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_by text`);
  await c.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_reason text`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_employees_deleted_at ON employees(deleted_at)`);
  console.log('✓ employees soft-delete columns (deleted_at, deleted_by, deleted_reason)');

  // Sanity
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='employees' AND column_name LIKE 'deleted%'`);
  console.log('  employees deleted* columns:', cols.rows.map(r=>r.column_name).join(', '));

  console.log('\nMigration complete.');
  await c.end();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

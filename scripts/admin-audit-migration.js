const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_email  text,
      actor_role   text,
      action       text NOT NULL,        -- e.g. permission_matrix.update, user.role_change
      entity_type  text,                 -- e.g. role_permissions, user, leave_visibility_config
      entity_id    text,                 -- target identifier (uuid/email/role)
      summary      text,                 -- human-readable one-liner
      old_value    jsonb,
      new_value    jsonb,
      ip_address   text,
      user_agent   text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_email, created_at DESC)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_log(entity_type, entity_id)`);
  // RLS on, no client policies → server-only access (reads go through withPgClient)
  await c.query(`ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY`);
  console.log('✓ admin_audit_log table + indexes + RLS');

  const cnt = await c.query(`SELECT COUNT(*)::int n FROM admin_audit_log`);
  console.log('  rows:', cnt.rows[0].n);
  await c.end();
}
run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

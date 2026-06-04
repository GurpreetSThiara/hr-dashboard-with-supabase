const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS field_permissions (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      object_id     uuid NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
      field_id      uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
      principal_type text NOT NULL CHECK (principal_type IN ('user','role','role_group','department')),
      principal_id   text NOT NULL,
      can_view      boolean NOT NULL DEFAULT true,
      can_edit      boolean NOT NULL DEFAULT false,
      created_by    text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (field_id, principal_type, principal_id)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_field_perms_object ON field_permissions(object_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_field_perms_field ON field_permissions(field_id)`);
  await c.query(`ALTER TABLE field_permissions ENABLE ROW LEVEL SECURITY`);
  await c.query(`DROP POLICY IF EXISTS field_permissions_read ON field_permissions`);
  await c.query(`CREATE POLICY field_permissions_read ON field_permissions FOR SELECT TO authenticated USING (true)`);
  console.log('✓ field_permissions table + indexes + RLS');
  await c.end();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

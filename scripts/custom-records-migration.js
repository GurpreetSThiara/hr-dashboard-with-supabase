const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS custom_records (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      object_id   uuid NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
      data        jsonb NOT NULL DEFAULT '{}',
      owner_email text,
      created_by  text,
      deleted_at  timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_custom_records_object ON custom_records(object_id) WHERE deleted_at IS NULL`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_custom_records_owner ON custom_records(LOWER(owner_email))`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_custom_records_data ON custom_records USING gin (data)`);
  await c.query(`ALTER TABLE custom_records ENABLE ROW LEVEL SECURITY`);
  await c.query(`DROP POLICY IF EXISTS custom_records_read ON custom_records`);
  await c.query(`CREATE POLICY custom_records_read ON custom_records FOR SELECT TO authenticated USING (true)`);
  console.log('✓ custom_records table + indexes + RLS');
  await c.end();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

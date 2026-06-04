const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS record_shares (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      object_id     uuid NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
      record_id     uuid NOT NULL REFERENCES custom_records(id) ON DELETE CASCADE,
      principal_type text NOT NULL CHECK (principal_type IN ('user','role','role_group','department')),
      principal_id   text NOT NULL,
      access_level   text NOT NULL CHECK (access_level IN ('none','view','comment','edit','approve','delete','full')),
      granted_by    text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (record_id, principal_type, principal_id)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_record_shares_record ON record_shares(record_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_record_shares_principal ON record_shares(principal_type, principal_id)`);
  await c.query(`ALTER TABLE record_shares ENABLE ROW LEVEL SECURITY`);
  await c.query(`DROP POLICY IF EXISTS record_shares_read ON record_shares`);
  await c.query(`CREATE POLICY record_shares_read ON record_shares FOR SELECT TO authenticated USING (true)`);
  console.log('✓ record_shares table + indexes + RLS');
  await c.end();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

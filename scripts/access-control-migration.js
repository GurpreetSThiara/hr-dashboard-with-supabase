const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS role_groups (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name        text NOT NULL UNIQUE,
      description text,
      created_by  text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`
    CREATE TABLE IF NOT EXISTS role_group_members (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id   uuid NOT NULL REFERENCES role_groups(id) ON DELETE CASCADE,
      user_email text NOT NULL,
      added_by   text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (group_id, user_email)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_rgm_email ON role_group_members(LOWER(user_email))`);
  console.log('✓ role_groups + role_group_members');

  await c.query(`
    CREATE TABLE IF NOT EXISTS permission_sets (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name        text NOT NULL UNIQUE,
      description text,
      permissions text[] NOT NULL DEFAULT '{}',
      created_by  text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`
    CREATE TABLE IF NOT EXISTS permission_set_assignments (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      set_id         uuid NOT NULL REFERENCES permission_sets(id) ON DELETE CASCADE,
      principal_type text NOT NULL CHECK (principal_type IN ('user','role_group')),
      principal_id   text NOT NULL,             -- user email OR role_group id
      granted_by     text,
      expires_at     timestamptz,               -- null = permanent
      is_active      boolean NOT NULL DEFAULT true,
      created_at     timestamptz NOT NULL DEFAULT now(),
      UNIQUE (set_id, principal_type, principal_id)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_psa_principal ON permission_set_assignments(principal_type, principal_id) WHERE is_active`);
  console.log('✓ permission_sets + permission_set_assignments');

  // RLS on; server-only writes; authenticated read (config is non-sensitive)
  for (const t of ['role_groups','role_group_members','permission_sets','permission_set_assignments']) {
    await c.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await c.query(`DROP POLICY IF EXISTS ${t}_read ON ${t}`);
    await c.query(`CREATE POLICY ${t}_read ON ${t} FOR SELECT TO authenticated USING (true)`);
  }
  console.log('✓ RLS enabled + authenticated-read policies');

  console.log('\nMigration complete.');
  await c.end();
}
run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

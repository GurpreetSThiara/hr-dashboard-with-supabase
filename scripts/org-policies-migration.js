const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  console.log('Connected.\n');

  // ── Policy repository ───────────────────────────────────────────────────────
  await c.query(`
    CREATE TABLE IF NOT EXISTS org_policies (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title        text NOT NULL,
      category     text NOT NULL DEFAULT 'General'
                   CHECK (category IN ('HR','Attendance','Leave','Expense','Travel','Compliance','General')),
      content      text,
      version      integer NOT NULL DEFAULT 1,
      effective_date date,
      expiry_date    date,
      requires_acknowledgement boolean NOT NULL DEFAULT true,
      is_active    boolean NOT NULL DEFAULT true,
      is_archived  boolean NOT NULL DEFAULT false,
      created_by   text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_org_policies_active ON org_policies(is_active, is_archived)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_org_policies_category ON org_policies(category)`);
  console.log('✓ org_policies');

  // ── Acknowledgements / read receipts ────────────────────────────────────────
  await c.query(`
    CREATE TABLE IF NOT EXISTS policy_acknowledgements (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id       uuid NOT NULL REFERENCES org_policies(id) ON DELETE CASCADE,
      policy_version  integer NOT NULL DEFAULT 1,
      employee_email  text NOT NULL,
      acknowledged_at timestamptz NOT NULL DEFAULT now(),
      ip_address      text,
      UNIQUE (policy_id, employee_email, policy_version)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_policy_ack_policy ON policy_acknowledgements(policy_id)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_policy_ack_email ON policy_acknowledgements(employee_email)`);
  console.log('✓ policy_acknowledgements');

  // RLS: read for authenticated; writes via server (withPgClient bypasses RLS)
  await c.query(`ALTER TABLE org_policies ENABLE ROW LEVEL SECURITY`);
  await c.query(`ALTER TABLE policy_acknowledgements ENABLE ROW LEVEL SECURITY`);
  await c.query(`DROP POLICY IF EXISTS org_policies_read ON org_policies`);
  await c.query(`CREATE POLICY org_policies_read ON org_policies FOR SELECT TO authenticated USING (true)`);
  await c.query(`DROP POLICY IF EXISTS policy_ack_read ON policy_acknowledgements`);
  await c.query(`CREATE POLICY policy_ack_read ON policy_acknowledgements FOR SELECT TO authenticated USING (true)`);
  console.log('✓ RLS enabled + authenticated-read policies');

  // ── Seed a few real starter policies (legitimate default content) ───────────
  const seed = [
    ['Code of Conduct', 'HR', 'All employees are expected to act with integrity, respect, and professionalism. Harassment, discrimination, and conflicts of interest are prohibited.'],
    ['Leave Policy', 'Leave', 'Annual, sick, and personal leave accrue per your assigned policy version. Requests must be submitted in advance via Leave & Attendance and are subject to manager approval.'],
    ['Attendance & Regularization Policy', 'Attendance', 'Employees must record check-in/out daily. Missed punches can be regularized within the configured window via the Regularizations tab, subject to reporting-manager approval.'],
    ['Information Security Policy', 'Compliance', 'Protect company and personal data. Use strong unique passwords, never share credentials, and report security incidents to IT immediately.'],
  ];
  for (const [title, category, content] of seed) {
    await c.query(
      `INSERT INTO org_policies (title, category, content, effective_date, created_by)
       SELECT $1, $2, $3, CURRENT_DATE, 'system'
       WHERE NOT EXISTS (SELECT 1 FROM org_policies WHERE title = $1)`,
      [title, category, content]
    );
  }
  const cnt = await c.query(`SELECT COUNT(*)::int n FROM org_policies`);
  console.log(`✓ seeded starter policies (total now: ${cnt.rows[0].n})`);

  console.log('\nMigration complete.');
  await c.end();
}
run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

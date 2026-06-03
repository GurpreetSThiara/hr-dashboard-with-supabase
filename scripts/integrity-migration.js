const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();
  console.log('Connected.\n');

  // ── 1. Find and re-point employee child FKs to ON DELETE RESTRICT ──────────
  const childTables = [
    'leave_requests',
    'attendance_records',
    'attendance_regularizations',
    'checkin_checkout_logs',
  ];

  for (const tbl of childTables) {
    // Find the existing FK constraint name on employee_id → employees
    const fkRes = await client.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_class frel ON frel.oid = con.confrelid
      WHERE con.contype = 'f'
        AND rel.relname = $1
        AND frel.relname = 'employees'
    `, [tbl]);

    for (const row of fkRes.rows) {
      await client.query(`ALTER TABLE ${tbl} DROP CONSTRAINT "${row.conname}"`);
      await client.query(`
        ALTER TABLE ${tbl}
        ADD CONSTRAINT ${tbl}_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      `);
      console.log(`✓ ${tbl}: FK ${row.conname} → RESTRICT`);
    }
    if (fkRes.rows.length === 0) {
      console.log(`! ${tbl}: no employee FK found (skipped)`);
    }
  }

  // ── 2. CHECK constraints on status / enum-like columns ─────────────────────
  // Use NOT VALID then VALIDATE so existing rows that already conform pass,
  // and bad future writes are blocked. Drop first if they exist (idempotent).
  const checks = [
    ['leave_requests', 'leave_requests_status_chk', `status IN ('pending','approved','rejected','cancelled')`],
    ['employees', 'employees_status_chk', `status IN ('active','terminated','onboarding','on_leave','suspended','inactive')`],
    ['attendance_records', 'attendance_records_status_chk', `status IN ('present','absent','late','half_day','wfh','leave','holiday')`],
    ['attendance_regularizations', 'attendance_regularizations_status_chk', `status IN ('pending','approved','rejected')`],
  ];

  for (const [tbl, name, expr] of checks) {
    try {
      await client.query(`ALTER TABLE ${tbl} DROP CONSTRAINT IF EXISTS ${name}`);
      // Show distinct existing values so we know the allowed set is complete
      const distinct = await client.query(`SELECT DISTINCT status FROM ${tbl}`);
      const vals = distinct.rows.map(r => r.status);
      await client.query(`ALTER TABLE ${tbl} ADD CONSTRAINT ${name} CHECK (${expr}) NOT VALID`);
      await client.query(`ALTER TABLE ${tbl} VALIDATE CONSTRAINT ${name}`);
      console.log(`✓ ${tbl}.status CHECK added (existing values: ${JSON.stringify(vals)})`);
    } catch (e) {
      console.log(`! ${tbl}.status CHECK failed: ${e.message}`);
    }
  }

  // ── 3. Re-enable RLS on role_permissions (script intends it; live had it off)
  try {
    await client.query(`ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY`);
    await client.query(`DROP POLICY IF EXISTS role_permissions_read ON role_permissions`);
    await client.query(`CREATE POLICY role_permissions_read ON role_permissions FOR SELECT TO authenticated USING (true)`);
    console.log('✓ role_permissions: RLS enabled + authenticated-read policy (writes via service role only)');
  } catch (e) {
    console.log(`! role_permissions RLS: ${e.message}`);
  }

  // ── 4. Index to speed the overlap trigger + balance view ───────────────────
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_dates ON leave_requests(employee_id, start_date, end_date)`);
    console.log('✓ idx_leave_requests_emp_dates created');
  } catch (e) {
    console.log(`! index: ${e.message}`);
  }

  console.log('\nMigration complete.');
  await client.end();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

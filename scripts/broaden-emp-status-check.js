const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query(`ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_chk`);
  await c.query(`ALTER TABLE employees ADD CONSTRAINT employees_status_chk
    CHECK (status IN ('active','inactive','terminated','onboarding','onleave','on_leave','suspended','probation')) NOT VALID`);
  await c.query(`ALTER TABLE employees VALIDATE CONSTRAINT employees_status_chk`);
  console.log('employees_status_chk broadened OK');
  await c.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });

const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();

  // 1. Directory public columns must all exist
  const pub = 'id, emp_id, first_name, last_name, email, designation, department, employment_type, manager, location, status, join_date, attendance_pct';
  const dir = await c.query(`SELECT ${pub} FROM employees WHERE deleted_at IS NULL AND status <> 'terminated' ORDER BY first_name LIMIT 3`);
  console.log('✓ directory query OK — sample:', dir.rows.map(r=>`${r.first_name} ${r.last_name} (${r.designation})`).join('; '));
  console.log('  columns returned:', Object.keys(dir.rows[0]||{}).join(', '));
  console.log('  salary_band present in directory result?', 'salary_band' in (dir.rows[0]||{}) ? 'YES (BUG)' : 'no ✓');

  // 2. Audit insert round-trip
  const emp = await c.query(`SELECT id, emp_id FROM employees LIMIT 1`);
  const e = emp.rows[0];
  const ins = await c.query(
    `INSERT INTO employee_audit_log (employee_id, employee_emp_id, actor_email, actor_role, action, changed_fields, old_values, new_values, ip_address, user_agent)
     VALUES ($1,$2,'tester@hrcore.io','Super Admin','updated', ARRAY['department'], '{"department":"A"}', '{"department":"B"}', '127.0.0.1','jest') RETURNING id`,
    [e.id, e.emp_id]
  );
  console.log('✓ audit insert OK, id=', ins.rows[0].id);
  const read = await c.query(`SELECT action, changed_fields, old_values, new_values FROM employee_audit_log WHERE id=$1`, [ins.rows[0].id]);
  console.log('  read back:', JSON.stringify(read.rows[0]));
  await c.query(`DELETE FROM employee_audit_log WHERE id=$1`, [ins.rows[0].id]);
  console.log('  cleanup OK');

  // 3. Soft-delete round trip (dry — just confirm columns accept values)
  await c.query(`SELECT deleted_at, deleted_by, deleted_reason FROM employees LIMIT 1`);
  console.log('✓ soft-delete columns selectable');

  await c.end();
}
run().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});

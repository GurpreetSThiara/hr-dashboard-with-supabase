const { Client } = require('pg');
async function run(){
  const c = new Client({connectionString: process.env.POSTGRES_URL});
  await c.connect();
  const r = await c.query(`SELECT email, manager FROM employees WHERE manager IS NOT NULL AND manager LIKE '%@%' ORDER BY emp_id LIMIT 5`);
  console.log('Sample employee → reporting manager mappings:');
  r.rows.forEach(x => console.log(`  ${x.email}  →  ${x.manager}`));
  const hr = await c.query(`SELECT COUNT(*)::int n FROM users WHERE role = ANY($1)`, [['Super Admin','Owner','Admin','HR Admin','HR Manager','HR Executive']]);
  console.log(`HR approver users (org-wide fallback recipients): ${hr.rows[0].n}`);
  await c.end();
}
run().catch(e=>{console.error(e.message);process.exit(1);});

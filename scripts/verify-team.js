const { Client } = require('pg');
const PUB = `id, emp_id, first_name, last_name, email, designation, department, employment_type, manager, location, status, join_date, attendance_pct`;
async function run(){
  const c = new Client({connectionString: process.env.POSTGRES_URL});
  await c.connect();
  const myEmail = 'hradmin@hrcore.io';
  const direct = await c.query(`SELECT ${PUB} FROM employees WHERE LOWER(manager)=LOWER($1) AND deleted_at IS NULL ORDER BY first_name`, [myEmail]);
  console.log(`Direct reports of ${myEmail}:`, direct.rows.map(r=>`${r.first_name} ${r.last_name}`).join(', ') || '(none)');
  const hier = await c.query(`
    WITH RECURSIVE hier AS (
      SELECT id,email,manager,1 lvl FROM employees WHERE LOWER(manager)=LOWER($1) AND deleted_at IS NULL
      UNION ALL
      SELECT e.id,e.email,e.manager,h.lvl+1 FROM employees e JOIN hier h ON LOWER(e.manager)=LOWER(h.email) WHERE e.deleted_at IS NULL)
    SELECT id,lvl FROM hier`, [myEmail]);
  console.log('Full hierarchy size:', hier.rows.length, '| extended:', hier.rows.filter(r=>r.lvl>1).length);
  const chain = await c.query(`
    WITH RECURSIVE chain AS (
      SELECT id,email,designation,manager,0 depth FROM employees WHERE LOWER(email)=LOWER($1)
      UNION ALL
      SELECT e.id,e.email,e.designation,e.manager,c.depth+1 FROM employees e JOIN chain c ON LOWER(e.email)=LOWER(c.manager) WHERE c.depth<10)
    SELECT email,designation,depth FROM chain WHERE depth>0 ORDER BY depth`, [myEmail]);
  console.log('Reporting chain up:', chain.rows.map(r=>`${r.depth}:${r.email}`).join(' -> ') || '(top)');
  const anni = await c.query(`SELECT first_name,join_date FROM employees WHERE EXTRACT(MONTH FROM join_date)=EXTRACT(MONTH FROM CURRENT_DATE) LIMIT 5`);
  console.log('Anniversaries this month (any):', anni.rows.length);
  console.log('salary_band in team result?', 'salary_band' in (direct.rows[0]||{}) ? 'YES(BUG)' : 'no');
  await c.end();
}
run().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});

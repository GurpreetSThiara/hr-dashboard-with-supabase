const { Client } = require('pg');
async function run(){
  const c = new Client({connectionString: process.env.POSTGRES_URL});
  await c.connect();
  const counts = await c.query(`
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
      COUNT(*) FILTER (WHERE status='active' AND deleted_at IS NULL)::int AS active,
      COUNT(*) FILTER (WHERE join_date >= CURRENT_DATE - INTERVAL '90 days')::int AS new90
    FROM employees`);
  console.log('Overview counts:', counts.rows[0]);
  const depts = await c.query(`SELECT COALESCE(department,'Unassigned') name, COUNT(*)::int value FROM employees WHERE deleted_at IS NULL AND status='active' GROUP BY 1 ORDER BY value DESC`);
  console.log('Dept distribution:', depts.rows.map(r=>`${r.name}:${r.value}`).join(', '));
  const locs = await c.query(`SELECT COALESCE(location,'Unassigned') name, COUNT(*)::int value FROM employees WHERE deleted_at IS NULL AND status='active' GROUP BY 1 ORDER BY value DESC`);
  console.log('Location distribution:', locs.rows.map(r=>`${r.name}:${r.value}`).join(', '));
  // chart roots count
  const emps = await c.query(`SELECT email, manager FROM employees WHERE deleted_at IS NULL AND status='active'`);
  const set = new Set(emps.rows.map(r=>(r.email||'').toLowerCase()));
  const roots = emps.rows.filter(r=>!r.manager || !set.has(String(r.manager).toLowerCase()));
  console.log('Org chart root nodes:', roots.length, '(', roots.map(r=>r.email).join(', '), ')');
  const pol = await c.query(`SELECT title, category, version FROM org_policies WHERE is_active AND NOT is_archived ORDER BY category`);
  console.log('Active policies:', pol.rows.map(p=>`${p.title}[${p.category}]`).join(', '));
  await c.end();
}
run().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});

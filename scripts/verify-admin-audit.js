const { Client } = require('pg');
async function run(){
  const c = new Client({connectionString: process.env.POSTGRES_URL});
  await c.connect();
  // simulate a log write like logAdminAction would do
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO admin_audit_log (actor_email, actor_role, action, entity_type, entity_id, summary, old_value, new_value, ip_address, user_agent)
     VALUES ('admin@hrcore.io','Admin','user.role_change','user','abc','Changed x: Employee -> Manager', $1, $2, '10.0.0.1','jest')`,
    [JSON.stringify({role:'Employee',tier:15}), JSON.stringify({role:'Manager',tier:13})]
  );
  const r = await c.query(`SELECT action, entity_type, summary, old_value, new_value FROM admin_audit_log ORDER BY created_at DESC LIMIT 1`);
  console.log('Wrote + read audit row:', JSON.stringify(r.rows[0]));
  await c.query('ROLLBACK');
  console.log('rollback OK (no test data persisted)');
  await c.end();
}
run().catch(e=>{console.error('FAIL:',e.message);process.exit(1);});

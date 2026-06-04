const { Client } = require('pg');

// Mirrors src/lib/accessControl.ts loadGrantedPermissions
async function granted(c, email) {
  const res = await c.query(`
    SELECT DISTINCT perm FROM (
      SELECT unnest(ps.permissions) AS perm
      FROM permission_set_assignments a
      JOIN permission_sets ps ON ps.id = a.set_id
      WHERE a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND (
          (a.principal_type='user' AND LOWER(a.principal_id)=LOWER($1))
          OR (a.principal_type='role_group' AND a.principal_id IN (
                SELECT group_id::text FROM role_group_members WHERE LOWER(user_email)=LOWER($1)))
        )
    ) g`, [email]);
  return res.rows.map(r => r.perm);
}

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query('BEGIN');

  const email = 'employee@hrcore.io'; // tier 15 — normally NO manage_employees
  console.log('Before grant — granted perms:', await granted(c, email));

  // Create set + direct user assignment
  const set = await c.query(`INSERT INTO permission_sets (name, permissions, created_by) VALUES ('TEST Power', ARRAY['manage_employees','view_hr_dashboard'], 'tester') RETURNING id`);
  await c.query(`INSERT INTO permission_set_assignments (set_id, principal_type, principal_id, granted_by) VALUES ($1,'user',$2,'tester')`, [set.rows[0].id, email]);
  console.log('After USER grant — granted perms:', await granted(c, email));

  // Now test role-group path: create group, add user, assign set to group, remove direct
  await c.query(`DELETE FROM permission_set_assignments WHERE set_id=$1`, [set.rows[0].id]);
  const grp = await c.query(`INSERT INTO role_groups (name, created_by) VALUES ('TEST Group','tester') RETURNING id`);
  await c.query(`INSERT INTO role_group_members (group_id, user_email, added_by) VALUES ($1,$2,'tester')`, [grp.rows[0].id, email]);
  await c.query(`INSERT INTO permission_set_assignments (set_id, principal_type, principal_id, granted_by) VALUES ($1,'role_group',$2,'tester')`, [set.rows[0].id, grp.rows[0].id]);
  console.log('After GROUP grant — granted perms:', await granted(c, email));

  // Expired grant should NOT count
  await c.query(`UPDATE permission_set_assignments SET expires_at = now() - interval '1 day'`);
  console.log('After EXPIRY — granted perms:', await granted(c, email), '(should be empty)');

  await c.query('ROLLBACK');
  console.log('rollback OK (no test data persisted)');
  await c.end();
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

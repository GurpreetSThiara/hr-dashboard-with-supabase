const { Client } = require('pg');
const RANK = { none:0, view:1, comment:2, edit:3, approve:4, delete:5, full:6 };

// Mirrors resolveRecordAccess logic
async function resolve(c, principals, record) {
  if (principals.isAdmin) return 'full';
  if ((record.owner_email||'').toLowerCase() === principals.email) return 'full';
  const res = await c.query(
    `SELECT access_level FROM record_shares WHERE record_id=$1 AND access_level<>'none'
      AND ( (principal_type='user' AND LOWER(principal_id)=$2)
         OR (principal_type='role' AND principal_id=$3)
         OR (principal_type='role_group' AND principal_id = ANY($4))
         OR (principal_type='department' AND principal_id=$5) )`,
    [record.id, principals.email, principals.role, principals.groupIds, principals.department]);
  let best='none';
  for (const r of res.rows) if (RANK[r.access_level] > RANK[best]) best = r.access_level;
  return best;
}

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query('BEGIN');

  const o = await c.query(`INSERT INTO custom_objects (api_name,label,created_by) VALUES ('deal','Deal','tester') RETURNING id`);
  const oid = o.rows[0].id;
  const rec = await c.query(`INSERT INTO custom_records (object_id,data,owner_email,created_by) VALUES ($1,'{"name":"ACME"}','owner@hrcore.io','owner@hrcore.io') RETURNING id, owner_email`, [oid]);
  const record = rec.rows[0];

  const stranger = { email:'employee@hrcore.io', role:'Employee', groupIds:[], department:'Engineering', isAdmin:false };
  console.log('Stranger before any share:', await resolve(c, stranger, record), '(expect none)');

  // Share to the user directly with edit
  await c.query(`INSERT INTO record_shares (object_id,record_id,principal_type,principal_id,access_level,granted_by) VALUES ($1,$2,'user','employee@hrcore.io','edit','owner@hrcore.io')`, [oid, record.id]);
  console.log('After USER edit share:', await resolve(c, stranger, record), '(expect edit)');

  // Add a department share with full → max wins
  await c.query(`INSERT INTO record_shares (object_id,record_id,principal_type,principal_id,access_level,granted_by) VALUES ($1,$2,'department','Engineering','full','owner@hrcore.io')`, [oid, record.id]);
  console.log('After +department full share:', await resolve(c, stranger, record), '(expect full — max wins)');

  // Owner + admin always full
  console.log('Owner access:', await resolve(c, { email:'owner@hrcore.io', role:'Employee', groupIds:[], department:null, isAdmin:false }, record), '(expect full)');
  console.log('Admin access:', await resolve(c, { email:'admin@hrcore.io', role:'Admin', groupIds:[], department:null, isAdmin:true }, record), '(expect full)');

  // Unrelated user (different dept, no share)
  const other = { email:'finance@hrcore.io', role:'Finance', groupIds:[], department:'Finance', isAdmin:false };
  console.log('Unrelated user:', await resolve(c, other, record), '(expect none)');

  await c.query('ROLLBACK');
  console.log('rollback OK (no test data persisted)');
  await c.end();
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

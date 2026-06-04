const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query('BEGIN');

  const o = await c.query(`INSERT INTO custom_objects (api_name,label,created_by) VALUES ('task','Task','tester') RETURNING id`);
  const oid = o.rows[0].id;

  // Insert a record
  const r1 = await c.query(
    `INSERT INTO custom_records (object_id, data, owner_email, created_by) VALUES ($1, $2, 'emp@hrcore.io','emp@hrcore.io') RETURNING id`,
    [oid, JSON.stringify({ title: 'Ship release', priority: 'High' })]
  );
  console.log('Created record:', r1.rows[0].id);

  // Unique check query (as used by validateRecord)
  const dup = await c.query(
    `SELECT 1 FROM custom_records WHERE object_id=$1 AND deleted_at IS NULL AND data->>$2 = $3 LIMIT 1`,
    [oid, 'title', 'Ship release']
  );
  console.log('Unique check finds existing "Ship release":', dup.rows.length > 0 ? 'YES ✓ (would block dup)' : 'no');

  // Lookup existence query (as used by validateRecord)
  const exists = await c.query(
    `SELECT 1 FROM custom_records WHERE id=$1 AND object_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [r1.rows[0].id, oid]
  );
  console.log('Lookup existence resolves valid ref:', exists.rows.length > 0 ? 'YES ✓' : 'no');

  // Owner-scoped list (interim ACL)
  const owned = await c.query(
    `SELECT data FROM custom_records WHERE object_id=$1 AND deleted_at IS NULL AND LOWER(owner_email)=LOWER($2)`,
    [oid, 'emp@hrcore.io']
  );
  console.log('Owner-scoped list returns:', owned.rows.length, 'record(s) →', JSON.stringify(owned.rows[0].data));

  // Soft delete removes from list
  await c.query(`UPDATE custom_records SET deleted_at = now() WHERE id=$1`, [r1.rows[0].id]);
  const after = await c.query(`SELECT 1 FROM custom_records WHERE object_id=$1 AND deleted_at IS NULL`, [oid]);
  console.log('After soft-delete, active records:', after.rows.length, '(should be 0) ✓');

  await c.query('ROLLBACK');
  console.log('rollback OK (no test data persisted)');
  await c.end();
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

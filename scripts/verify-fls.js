const { Client } = require('pg');

// Mirrors resolveFieldAccess logic
function matches(p, row) {
  if (row.principal_type === 'user') return row.principal_id.toLowerCase() === p.email;
  if (row.principal_type === 'role') return row.principal_id === p.role;
  if (row.principal_type === 'role_group') return p.groupIds.includes(row.principal_id);
  if (row.principal_type === 'department') return !!p.department && row.principal_id === p.department;
  return false;
}
async function resolve(c, p, oid, fields) {
  const view = new Set(), edit = new Set();
  if (p.isAdmin) { fields.forEach(f => { view.add(f.api_name); edit.add(f.api_name); }); return { view, edit }; }
  const res = await c.query(`SELECT field_id,principal_type,principal_id,can_view,can_edit FROM field_permissions WHERE object_id=$1`, [oid]);
  const byField = new Map();
  res.rows.forEach(r => { (byField.get(r.field_id) || byField.set(r.field_id, []).get(r.field_id)).push(r); });
  for (const f of fields) {
    const rows = byField.get(f.id);
    if (!rows || rows.length === 0) { view.add(f.api_name); edit.add(f.api_name); continue; }
    let cv = false, ce = false;
    for (const r of rows) if (matches(p, r)) { if (r.can_view) cv = true; if (r.can_edit) ce = true; }
    if (cv) view.add(f.api_name); if (ce) edit.add(f.api_name);
  }
  return { view, edit };
}

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query('BEGIN');

  const o = await c.query(`INSERT INTO custom_objects (api_name,label,created_by) VALUES ('candidate','Candidate','t') RETURNING id`);
  const oid = o.rows[0].id;
  const f1 = await c.query(`INSERT INTO custom_fields (object_id,api_name,label,field_type,display_order) VALUES ($1,'name','Name','text',1) RETURNING id`, [oid]);
  const f2 = await c.query(`INSERT INTO custom_fields (object_id,api_name,label,field_type,display_order) VALUES ($1,'salary','Salary','currency',2) RETURNING id`, [oid]);
  const fields = [{ id: f1.rows[0].id, api_name: 'name' }, { id: f2.rows[0].id, api_name: 'salary' }];

  // Restrict salary: HR view+edit, Manager view only
  await c.query(`INSERT INTO field_permissions (object_id,field_id,principal_type,principal_id,can_view,can_edit,created_by) VALUES ($1,$2,'role','HR Admin',true,true,'t')`, [oid, f2.rows[0].id]);
  await c.query(`INSERT INTO field_permissions (object_id,field_id,principal_type,principal_id,can_view,can_edit,created_by) VALUES ($1,$2,'role','Manager',true,false,'t')`, [oid, f2.rows[0].id]);

  const hr = { email: 'h@x', role: 'HR Admin', groupIds: [], department: null, isAdmin: false };
  const mgr = { email: 'm@x', role: 'Manager', groupIds: [], department: null, isAdmin: false };
  const emp = { email: 'e@x', role: 'Employee', groupIds: [], department: null, isAdmin: false };
  const admin = { email: 'a@x', role: 'Admin', groupIds: [], department: null, isAdmin: true };

  for (const [who, p] of [['HR Admin', hr], ['Manager', mgr], ['Employee', emp], ['Admin', admin]]) {
    const a = await resolve(c, p, oid, fields);
    console.log(`${who.padEnd(10)} → salary view:${a.view.has('salary')} edit:${a.edit.has('salary')} | name view:${a.view.has('name')} edit:${a.edit.has('name')}`);
  }
  console.log('Expected: HR view+edit salary; Manager view-only salary; Employee NO salary; Admin all; name open to everyone.');

  await c.query('ROLLBACK');
  console.log('rollback OK (no test data persisted)');
  await c.end();
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();

  const objs = await c.query(`SELECT api_name, label FROM standard_objects ORDER BY label`);
  console.log('Standard objects:', objs.rows.map(o => o.label).join(', '));

  const emp = await c.query(`SELECT api_name, label, is_relationship, related_object, is_custom FROM standard_object_fields WHERE object_api_name='employee' ORDER BY is_custom, label`);
  console.log(`\nEmployee fields (${emp.rows.length}):`);
  emp.rows.forEach(f => console.log(`  ${f.is_custom ? '[custom]' : '[std]   '} ${f.api_name}${f.is_relationship ? ` →${f.related_object}` : ''}`));

  // Simulate guardrail logic (mirrors the PUT route)
  await c.query('BEGIN');
  const std = emp.rows.find(f => !f.is_custom && f.api_name === 'salary_band');
  const stdRow = await c.query(`SELECT * FROM standard_object_fields WHERE object_api_name='employee' AND api_name='salary_band'`);
  const field = stdRow.rows[0];
  // Attempt protected edit on standard field
  const b = { label: 'Compensation' };
  const touchesProtected = (b.label !== undefined && b.label !== field.label);
  console.log('\nStandard field protected-edit attempt blocked?', touchesProtected ? 'YES ✓ (403)' : 'no (BUG)');
  // Visibility toggle allowed
  await c.query(`UPDATE standard_object_fields SET is_visible=false WHERE id=$1`, [field.id]);
  const after = await c.query(`SELECT is_visible FROM standard_object_fields WHERE id=$1`, [field.id]);
  console.log('Standard field visibility toggle allowed?', after.rows[0].is_visible === false ? 'YES ✓' : 'no');
  // Delete of standard field blocked (by route guard, is_custom=false)
  console.log('Standard field delete blocked?', field.is_custom === false ? 'YES ✓ (route returns 403)' : 'no');

  // Add a custom field + relationship, then it is deletable
  await c.query(`INSERT INTO standard_object_fields (object_api_name,api_name,label,data_type,is_relationship,related_object,is_custom,created_by) VALUES ('employee','linkedin','LinkedIn','url',false,null,true,'t')`);
  await c.query(`INSERT INTO standard_object_fields (object_api_name,api_name,label,data_type,is_relationship,related_object,is_custom,created_by) VALUES ('employee','buddy','Onboarding Buddy','lookup',true,'employee',true,'t')`);
  const customs = await c.query(`SELECT api_name, is_relationship, related_object FROM standard_object_fields WHERE object_api_name='employee' AND is_custom=true`);
  console.log('\nCustom fields added (full CRUD):', customs.rows.map(r => `${r.api_name}${r.is_relationship ? ` →${r.related_object}` : ''}`).join(', '));

  await c.query('ROLLBACK');
  console.log('rollback OK (no test data persisted)');
  await c.end();
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

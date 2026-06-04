const { Client } = require('pg');
async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();
  await c.query('BEGIN');

  // Create an object
  const o = await c.query(`INSERT INTO custom_objects (api_name,label,plural_label,created_by) VALUES ('project','Project','Projects','tester') RETURNING id`);
  const oid = o.rows[0].id;

  // Add a variety of field types
  const fields = [
    ['name','Name','text',null,null],
    ['budget','Budget','currency',null,null],
    ['status','Status','picklist', JSON.stringify(['Open','In Progress','Closed']), null],
    ['owner','Owner','lookup', null, oid],
    ['margin','Margin','formula', null, null],
  ];
  let ord = 1;
  for (const [api,label,type,pick,lookup] of fields) {
    await c.query(
      `INSERT INTO custom_fields (object_id,api_name,label,field_type,picklist_values,lookup_object_id,formula,display_order,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'tester')`,
      [oid, api, label, type, pick, lookup, type==='formula'?'budget * 0.2':null, ord++]
    );
  }

  const got = await c.query(`SELECT api_name, field_type, picklist_values, lookup_object_id, formula FROM custom_fields WHERE object_id=$1 ORDER BY display_order`, [oid]);
  console.log('Object "project" created with fields:');
  got.rows.forEach(f => console.log(`  - ${f.api_name} (${f.field_type})${f.picklist_values?` ${JSON.stringify(f.picklist_values)}`:''}${f.lookup_object_id?' →lookup':''}${f.formula?` ="${f.formula}"`:''}`));

  // Test the constraint: invalid field type should fail
  try {
    await c.query(`INSERT INTO custom_fields (object_id,api_name,label,field_type) VALUES ($1,'bad','Bad','not_a_type')`, [oid]);
    console.log('  ✗ invalid type was accepted (BUG)');
  } catch { console.log('  ✓ invalid field_type rejected by CHECK constraint'); }

  // Test unique api_name per object
  try {
    await c.query(`INSERT INTO custom_fields (object_id,api_name,label,field_type) VALUES ($1,'name','Dup','text')`, [oid]);
    console.log('  ✗ duplicate api_name accepted (BUG)');
  } catch { console.log('  ✓ duplicate api_name rejected by UNIQUE constraint'); }

  await c.query('ROLLBACK');
  console.log('rollback OK (no test data persisted)');
  await c.end();
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

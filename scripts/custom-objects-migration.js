const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.POSTGRES_URL });
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS custom_objects (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      api_name     text NOT NULL UNIQUE,    -- machine name, e.g. 'project'
      label        text NOT NULL,
      plural_label text,
      description  text,
      icon         text,
      is_active    boolean NOT NULL DEFAULT true,
      is_archived  boolean NOT NULL DEFAULT false,
      created_by   text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    );
  `);
  console.log('✓ custom_objects');

  await c.query(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      object_id     uuid NOT NULL REFERENCES custom_objects(id) ON DELETE CASCADE,
      api_name      text NOT NULL,
      label         text NOT NULL,
      field_type    text NOT NULL CHECK (field_type IN (
        'text','number','currency','percent','date','datetime','email','phone','url',
        'picklist','multipicklist','boolean','formula','richtext','file','lookup','multilookup'
      )),
      config        jsonb NOT NULL DEFAULT '{}',
      is_required   boolean NOT NULL DEFAULT false,
      is_unique     boolean NOT NULL DEFAULT false,
      default_value text,
      picklist_values jsonb,                  -- ['Open','Closed'] for (multi)picklist
      lookup_object_id uuid REFERENCES custom_objects(id) ON DELETE SET NULL, -- (multi)lookup target
      formula       text,                     -- for formula fields
      display_order integer NOT NULL DEFAULT 0,
      is_archived   boolean NOT NULL DEFAULT false,
      created_by    text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (object_id, api_name)
    );
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_custom_fields_object ON custom_fields(object_id, display_order)`);
  console.log('✓ custom_fields');

  for (const t of ['custom_objects', 'custom_fields']) {
    await c.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await c.query(`DROP POLICY IF EXISTS ${t}_read ON ${t}`);
    await c.query(`CREATE POLICY ${t}_read ON ${t} FOR SELECT TO authenticated USING (true)`);
  }
  console.log('✓ RLS enabled + authenticated-read policies');

  console.log('\nMigration complete.');
  await c.end();
}
run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

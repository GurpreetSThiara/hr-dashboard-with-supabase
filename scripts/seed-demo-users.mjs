import pg from 'pg';
import crypto from 'crypto';

const postgresUrl = process.env.POSTGRES_URL;

if (!postgresUrl) {
  console.error('❌ Missing POSTGRES_URL in environment variables.');
  process.exit(1);
}

const demoUsers = [
  { email: 'superadmin@hrcore.io', password: 'HRCore@SA1', role: 'Super Admin', tier: 1 },
  { email: 'owner@hrcore.io', password: 'HRCore@OW2', role: 'Owner', tier: 2 },
  { email: 'admin@hrcore.io', password: 'HRCore@AD3', role: 'Admin', tier: 3 },
  { email: 'hradmin@hrcore.io', password: 'HRCore@HA4', role: 'HR Admin', tier: 4 },
  { email: 'hrmanager@hrcore.io', password: 'HRCore@HM5', role: 'HR Manager', tier: 5 },
  { email: 'hrexec@hrcore.io', password: 'HRCore@HE6', role: 'HR Executive', tier: 6 },
  { email: 'recruiter@hrcore.io', password: 'HRCore@RC7', role: 'Recruiter', tier: 7 },
  { email: 'payroll@hrcore.io', password: 'HRCore@PM8', role: 'Payroll Manager', tier: 8 },
  { email: 'finance@hrcore.io', password: 'HRCore@FA9', role: 'Finance', tier: 9 },
  { email: 'compliance@hrcore.io', password: 'HRCore@CA10', role: 'Compliance', tier: 10 },
  { email: 'itops@hrcore.io', password: 'HRCore@IT11', role: 'IT Ops', tier: 11 },
  { email: 'director@hrcore.io', password: 'HRCore@DR12', role: 'Director', tier: 12 },
  { email: 'manager@hrcore.io', password: 'HRCore@MG13', role: 'Manager', tier: 13 },
  { email: 'teamlead@hrcore.io', password: 'HRCore@TL14', role: 'Team Lead', tier: 14 },
  { email: 'employee@hrcore.io', password: 'HRCore@EM15', role: 'Employee', tier: 15 },
  { email: 'contractor@hrcore.io', password: 'HRCore@CT16', role: 'Contractor', tier: 16 },
  { email: 'intern@hrcore.io', password: 'HRCore@IN17', role: 'Intern', tier: 17 },
  { email: 'readonly@hrcore.io', password: 'HRCore@RO18', role: 'Read-Only User', tier: 18 },
];

async function seedUsers() {
  console.log('🌱 Starting direct database seeding of demo users to Supabase...\n');
  const pgClient = new pg.Client({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();
    console.log('✅ Connected to database. Beginning transaction...');

    for (const user of demoUsers) {
      console.log(`Processing: ${user.email} (${user.role})`);
      
      // Start user transaction
      await pgClient.query('BEGIN');
      
      try {
        // Check if user already exists in auth.users
        const checkRes = await pgClient.query('SELECT id FROM auth.users WHERE email = $1', [user.email]);
        
        let userId;
        const rawUserMetadata = {
          role: user.role,
          tier: user.tier,
          email: user.email,
          full_name: user.role,
          email_verified: true,
          phone_verified: false
        };

        if (checkRes.rows.length > 0) {
          userId = checkRes.rows[0].id;
          rawUserMetadata.sub = userId;
          
          console.log(`  - User exists in auth (ID: ${userId}). Updating password and metadata...`);
          
          // Update auth.users password & metadata
          await pgClient.query(
            `UPDATE auth.users 
             SET encrypted_password = crypt($1, gen_salt('bf', 10)),
                 raw_user_meta_data = $2,
                 email_confirmed_at = NOW(),
                 updated_at = NOW()
             WHERE id = $3`,
            [user.password, JSON.stringify(rawUserMetadata), userId]
          );

          // Update auth.identities metadata
          await pgClient.query(
            `UPDATE auth.identities
             SET identity_data = $1,
                 updated_at = NOW()
             WHERE user_id = $2`,
            [JSON.stringify(rawUserMetadata), userId]
          );
        } else {
          // Generate new user ID
          userId = crypto.randomUUID();
          rawUserMetadata.sub = userId;
          
          console.log(`  - Creating new auth record (ID: ${userId})...`);
          
          // Insert auth.users
          await pgClient.query(
            `INSERT INTO auth.users (
               instance_id, id, aud, role, email, encrypted_password, 
               email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
               is_super_admin, created_at, updated_at, is_sso_user, is_anonymous
             )
             VALUES (
               '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, 
               crypt($3, gen_salt('bf', 10)), NOW(), 
               '{"provider":"email","providers":["email"]}', $4,
               false, NOW(), NOW(), false, false
             )`,
            [userId, user.email, user.password, JSON.stringify(rawUserMetadata)]
          );

          // Insert auth.identities (email column is ALWAYS GENERATED, so omit it)
          const identityId = crypto.randomUUID();
          await pgClient.query(
            `INSERT INTO auth.identities (
               id, user_id, identity_data, provider, provider_id, 
               last_sign_in_at, created_at, updated_at
             )
             VALUES (
               $1, $2, $3, 'email', $4,
               NOW(), NOW(), NOW()
             )`,
            [identityId, userId, JSON.stringify(rawUserMetadata), userId]
          );
        }

        // Upsert public.users profile
        await pgClient.query(
          `INSERT INTO public.users (id, email, full_name, role, tier, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (email) 
           DO UPDATE SET id = EXCLUDED.id, role = EXCLUDED.role, tier = EXCLUDED.tier, updated_at = NOW()`,
          [userId, user.email, user.role, user.role, user.tier]
        );

        await pgClient.query('COMMIT');
        console.log(`  - Successfully seeded ${user.email}!\n`);
      } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error(`  - ❌ Error seeding ${user.email}:`, err.message, '\n');
      }
    }

    console.log('✨ Seeding complete!');
    console.log('\n📝 You can now login with any of these credentials:');
    console.log('Email: superadmin@hrcore.io, Password: HRCore@SA1');
    console.log('Email: employee@hrcore.io, Password: HRCore@EM15');
    
    await pgClient.end();
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seedUsers();

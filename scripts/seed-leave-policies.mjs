import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  serviceKey,
  { auth: { persistSession: false } }
);

const leaveTypes = [
  { name: 'Vacation', description: 'Annual vacation/holiday leave', color: '#3b82f6', requires_document: false },
  { name: 'Sick Leave', description: 'Leave for illness or medical appointments', color: '#ef4444', requires_document: true },
  { name: 'Personal Leave', description: 'Personal emergency leave', color: '#f59e0b', requires_document: false },
  { name: 'Maternity Leave', description: 'Leave for mothers during pregnancy and childbirth', color: '#ec4899', requires_document: true },
  { name: 'Paternity Leave', description: 'Leave for fathers after childbirth', color: '#06b6d4', requires_document: true },
  { name: 'Unpaid Leave', description: 'Leave without pay', color: '#6b7280', requires_document: false },
];

const leavePolicies = [
  { leave_type_name: 'Vacation', days_per_year: 20, carry_forward_allowed: true, max_carry_forward: 5, gender_specific: null },
  { leave_type_name: 'Sick Leave', days_per_year: 12, carry_forward_allowed: false, max_carry_forward: 0, gender_specific: null },
  { leave_type_name: 'Personal Leave', days_per_year: 5, carry_forward_allowed: false, max_carry_forward: 0, gender_specific: null },
  { leave_type_name: 'Maternity Leave', days_per_year: 120, carry_forward_allowed: false, max_carry_forward: 0, gender_specific: 'female' },
  { leave_type_name: 'Paternity Leave', days_per_year: 15, carry_forward_allowed: false, max_carry_forward: 0, gender_specific: 'male' },
  { leave_type_name: 'Unpaid Leave', days_per_year: 30, carry_forward_allowed: false, max_carry_forward: 0, gender_specific: null },
];

async function seedLeavePolicies() {
  try {
    console.log('Starting leave policies seeding...');

    // Insert leave types
    for (const type of leaveTypes) {
      const { data: existing } = await supabase
        .from('leave_types')
        .select('id')
        .eq('name', type.name)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('leave_types')
          .insert(type);
        if (error) console.error(`Error inserting leave type ${type.name}:`, error);
        else console.log(`Inserted leave type: ${type.name}`);
      }
    }

    console.log('All leave types inserted');

    // Insert leave policies
    for (const policy of leavePolicies) {
      // Get leave type ID
      const { data: leaveType } = await supabase
        .from('leave_types')
        .select('id')
        .eq('name', policy.leave_type_name)
        .single();

      if (leaveType) {
        const { data: existing } = await supabase
          .from('leave_policies')
          .select('id')
          .eq('leave_type_id', leaveType.id)
          .single();

        if (!existing) {
          const { error } = await supabase
            .from('leave_policies')
            .insert({
              ...policy,
              leave_type_id: leaveType.id,
            });
          if (error) console.error(`Error inserting policy for ${policy.leave_type_name}:`, error);
          else console.log(`Inserted leave policy: ${policy.leave_type_name}`);
        }
      }
    }

    console.log('Leave policies seeding complete!');
  } catch (error) {
    console.error('Error seeding leave policies:', error);
    process.exit(1);
  }
}

seedLeavePolicies();

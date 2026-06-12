// Single source of truth for the demo Super Owner account.
// The Super Owner is a platform-level account (tier 0) that belongs to NO
// organization (organization_id stays NULL in public.users).

export interface DemoSuperOwner {
  email: string;
  password: string;
  role: string;
  tier: number;
  full_name: string;
}

export const DEMO_SUPER_OWNER: DemoSuperOwner = {
  email: 'superowner@platform.io',
  password: 'SuperOwner@demo1',
  role: 'Super Owner',
  tier: 0,
  full_name: 'Platform Super Owner',
};

import { NextRequest, NextResponse } from 'next/server';

const DEMO_CREDENTIALS = [
  { tier: 1, role: 'Super Admin', email: 'superadmin@hrcore.io', password: 'HRCore@SA1' },
  { tier: 2, role: 'Owner', email: 'owner@hrcore.io', password: 'HRCore@OW2' },
  { tier: 3, role: 'Admin', email: 'admin@hrcore.io', password: 'HRCore@AD3' },
  { tier: 4, role: 'HR Admin', email: 'hradmin@hrcore.io', password: 'HRCore@HA4' },
  { tier: 5, role: 'HR Manager', email: 'hrmanager@hrcore.io', password: 'HRCore@HM5' },
  { tier: 6, role: 'HR Executive', email: 'hrexec@hrcore.io', password: 'HRCore@HE6' },
  { tier: 7, role: 'Recruiter', email: 'recruiter@hrcore.io', password: 'HRCore@RC7' },
  { tier: 8, role: 'Payroll Manager', email: 'payroll@hrcore.io', password: 'HRCore@PM8' },
  { tier: 9, role: 'Finance/Accounts', email: 'finance@hrcore.io', password: 'HRCore@FA9' },
  { tier: 10, role: 'Compliance/Auditor', email: 'compliance@hrcore.io', password: 'HRCore@CA10' },
  { tier: 11, role: 'IT/Admin Ops', email: 'itops@hrcore.io', password: 'HRCore@IT11' },
  { tier: 12, role: 'Director', email: 'director@hrcore.io', password: 'HRCore@DR12' },
  { tier: 13, role: 'Manager', email: 'manager@hrcore.io', password: 'HRCore@MG13' },
  { tier: 14, role: 'Team Lead', email: 'teamlead@hrcore.io', password: 'HRCore@TL14' },
  { tier: 15, role: 'Employee', email: 'employee@hrcore.io', password: 'HRCore@EM15' },
  { tier: 16, role: 'Contractor', email: 'contractor@hrcore.io', password: 'HRCore@CT16' },
  { tier: 17, role: 'Intern', email: 'intern@hrcore.io', password: 'HRCore@IN17' },
  { tier: 18, role: 'Read-Only User', email: 'readonly@hrcore.io', password: 'HRCore@RO18' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Verify credentials against demo list
    const credential = DEMO_CREDENTIALS.find(
      c => c.email === email && c.password === password
    );

    if (!credential) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create a demo token (base64 encoded JSON)
    const tokenData = {
      sub: `user_${email.replace(/[@.]/g, '_')}`,
      email,
      role: credential.role,
      tier: credential.tier,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    const accessToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    const refreshToken = Buffer.from(JSON.stringify({ email, created: Date.now() })).toString('base64');

    return NextResponse.json(
      {
        success: true,
        user: {
          id: `user_${email.replace(/[@.]/g, '_')}`,
          email,
          role: credential.role,
          tier: credential.tier,
          user_metadata: {
            role: credential.role,
            tier: credential.tier,
          },
        },
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 86400,
          token_type: 'Bearer',
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process login' },
      { status: 500 }
    );
  }
}

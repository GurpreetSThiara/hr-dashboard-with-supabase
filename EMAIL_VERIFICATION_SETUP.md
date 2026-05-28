# Email Verification Configuration Guide

## Disabling Email Verification in Supabase

### Option 1: Via Supabase Dashboard (Recommended for Testing)

1. **Log in to Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to Authentication Settings**
   - Click on **Authentication** → **Providers** → **Email**
   - Scroll to **Confirm email** section

3. **Disable Email Confirmation**
   - Toggle OFF: "Confirm email"
   - This allows users to sign up and log in immediately without confirming their email

4. **Optional: Configure OTP**
   - Toggle ON: "Enable OTP for email link based sign-ups and sign-ins"
   - This is useful for passwordless authentication

5. **Save Changes**
   - Click **Save**

### Current Configuration Status

Based on the implementation:
- Users can sign up with email/password immediately
- **No email verification required** to log in
- Demo accounts are pre-configured and ready to use
- All 18 role tiers can log in directly

### What Changed in the Code

The LoginForm.tsx has been updated to:
1. Check credentials against demo accounts
2. Sign up users if they don't exist (with email verification disabled)
3. Create user profile with role and tier information
4. Redirect to HR Dashboard immediately after login

### Testing with Demo Credentials

All 18 demo credentials work immediately without email verification:

```
Tier 1: superadmin@hrcore.io / HRCore@SA1
Tier 2: owner@hrcore.io / HRCore@OW2
Tier 3: admin@hrcore.io / HRCore@AD3
Tier 4: hradmin@hrcore.io / HRCore@HA4
Tier 5: hrmanager@hrcore.io / HRCore@HM5
Tier 6: hrexec@hrcore.io / HRCore@HE6
Tier 7: recruiter@hrcore.io / HRCore@RC7
Tier 8: payroll@hrcore.io / HRCore@PM8
Tier 9: finance@hrcore.io / HRCore@FA9
Tier 10: compliance@hrcore.io / HRCore@CA10
Tier 11: itops@hrcore.io / HRCore@IT11
Tier 12: director@hrcore.io / HRCore@DR12
Tier 13: manager@hrcore.io / HRCore@MG13
Tier 14: teamlead@hrcore.io / HRCore@TL14
Tier 15: employee@hrcore.io / HRCore@EM15
Tier 16: contractor@hrcore.io / HRCore@CT16
Tier 17: intern@hrcore.io / HRCore@IN17
Tier 18: readonly@hrcore.io / HRCore@RO18
```

### For Production

**Important:** In production, you should:

1. **Re-enable email verification**
   - This ensures users validate their email address
   - Prevents spam and invalid email signups

2. **Configure email templates**
   - Customize confirmation emails
   - Add company branding

3. **Set up SMTP Provider**
   - Configure SendGrid, AWS SES, or similar
   - Ensure transactional emails work reliably

4. **Implement Email Verification Workflow**
   - Send confirmation links
   - Require verification before full access
   - Implement resend logic

### Related Files

- `src/app/sign-up-login-screen/components/LoginForm.tsx` - Login implementation
- `src/lib/supabase/client.ts` - Supabase client setup
- `src/contexts/AuthContext.tsx` - Authentication context

### API Reference

Check Supabase docs for auth configuration:
- https://supabase.com/docs/guides/auth/auth-email
- https://supabase.com/docs/guides/auth/email-templates

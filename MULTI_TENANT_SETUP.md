# Multi-Tenant Email Magic Link Authentication Setup

Follow these steps in order to enable the new authentication system.

## Prerequisites

- Supabase project with database access
- Access to Supabase Dashboard

---

## Step 1: Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Get your keys from **Supabase Dashboard > Settings > API**:
- `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - service_role key (NEVER expose publicly)

---

## Step 2: Disable Public Signups (CRITICAL)

This prevents unauthorized users from creating accounts.

1. Go to **Supabase Dashboard > Authentication > Settings**
2. Under "User Signups", **DISABLE "Allow new users to sign up"**
3. Click **Save**

---

## Step 3: Configure Email Templates

1. Go to **Supabase Dashboard > Authentication > Email Templates**
2. Configure the **Magic Link** template:
   - Subject: `Sign in to {{.SiteURL}}`
   - Customize body as needed
3. Configure the **Invite User** template:
   - Subject: `You've been invited to Job Tickets`
   - Customize body with onboarding instructions

---

## Step 4: Configure Redirect URLs (CRITICAL for Production)

> **WARNING:** The Site URL determines where magic link emails redirect users. If set to `localhost`, users clicking magic links on mobile devices or other computers will get "cannot connect to server" errors.

1. Go to **Supabase Dashboard > Authentication > URL Configuration**
2. Set **Site URL**:
   - **Development:** `http://localhost:3000`
   - **Production:** `https://your-production-domain.com` (REQUIRED for deployed apps)
3. Add **Redirect URLs** (whitelist all environments):
   - `http://localhost:3000/login`
   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain.com/login`
   - `https://your-production-domain.com/auth/callback`
   - `https://*.your-production-domain.com/login` (for multi-tenant subdomains)
   - `https://*.your-production-domain.com/auth/callback`

> **Note:** You can only have ONE Site URL at a time. For production deployments, this MUST be your production domain.

---

## Step 5: Run Database Migrations

Open **Supabase Dashboard > SQL Editor** and run the combined migration file:

**Option A: Run all at once**
Copy the contents of `supabase/migrations/COMBINED_ALL_MIGRATIONS.sql` and execute.

**Option B: Run individually (recommended for debugging)**
Run each file in order:
1. `004_add_staff_email.sql`
2. `005_tenants.sql`
3. `006_profiles.sql`
4. `007_add_tenant_id.sql`
5. `008_tenant_functions.sql`
6. `009_profile_trigger.sql`
7. `010_rls_policies.sql`

---

## Step 6: Add Staff Emails

Edit `supabase/migrations/SETUP_EMAILS.sql` with actual email addresses, then run it in SQL Editor:

```sql
UPDATE staff SET email = 'frontdesk@yourdomain.com' WHERE id_code = 'SW01';
UPDATE staff SET email = 'mike@yourdomain.com' WHERE id_code = 'T01';
UPDATE staff SET email = 'jose@yourdomain.com' WHERE id_code = 'T02';
UPDATE staff SET email = 'sarah@yourdomain.com' WHERE id_code = 'T03';
UPDATE staff SET email = 'manager@yourdomain.com' WHERE id_code = 'ADMIN';
```

Verify with:
```sql
SELECT id_code, name, role, email FROM staff ORDER BY role, name;
```

---

## Step 7: Invite Staff Members

Once the app is running, a MANAGER can invite staff via the admin interface, or you can use the API directly:

**Via cURL (for initial setup):**
```bash
# First, get a manager's session token by logging in
# Then call the invite endpoint:

curl -X POST http://localhost:3000/api/admin/invite-staff \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"staffId": "<staff-uuid-from-database>"}'
```

**Via Supabase Dashboard (alternative):**
1. Go to **Authentication > Users**
2. Click **Invite user**
3. Enter the staff member's email
4. They'll receive an invite email to set up their account

---

## Step 8: Test the Login Flow

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000/login`
3. Enter an invited staff member's email
4. Check email for magic link
5. Click the link to complete authentication

---

## Verification Checklist

- [ ] Environment variables configured
- [ ] Public signups disabled in Supabase
- [ ] All migrations ran successfully
- [ ] Staff emails added to database
- [ ] At least one staff member invited
- [ ] Magic link login works end-to-end
- [ ] User redirects to correct dashboard based on role

---

## Troubleshooting

### "Your account must be created by an administrator"
- The email is not in the staff table, OR
- The user hasn't been invited yet

### "Business not found"
- The tenant slug doesn't exist in the tenants table
- Check the `x-tenant-slug` header is being set correctly

### "You do not have access to this business"
- User's profile.tenant_id doesn't match the current subdomain's tenant
- User logged in on wrong subdomain

### RLS errors / empty data
- Verify migrations ran in correct order (007 before 010)
- Check that `get_my_tenant_id()` function exists
- Verify user has a profile record

### Magic link redirects to localhost / "Cannot connect to server"
- **Cause:** The Site URL in Supabase Dashboard is set to `http://localhost:3000`
- **Fix:** Go to **Supabase Dashboard > Authentication > URL Configuration** and change the **Site URL** to your production domain (e.g., `https://your-domain.com`)
- **Note:** Magic link emails use the Site URL for redirects. This must match where your app is deployed.

---

## Security Notes

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** - It bypasses RLS
2. **Keep signups disabled** - Only invited users can create accounts
3. **Admin invite route** is protected by:
   - Authentication check
   - MANAGER role requirement
   - Cross-tenant protection
   - Rate limiting (10/min)

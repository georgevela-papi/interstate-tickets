# Interstate Tires Deployment Checklist

## Pre-Deployment Checklist

### Backend Setup (Supabase)
- [ ] Create Supabase account at https://supabase.com
- [ ] Create new project named "interstate-tickets"
- [ ] Wait for project initialization (~2 minutes)
- [ ] Run database migration:
  - [ ] Go to SQL Editor
  - [ ] Paste contents of `supabase/migrations/001_initial_schema.sql`
  - [ ] Click "Run" button
  - [ ] Verify success message
- [ ] Enable Realtime:
  - [ ] Go to Database → Replication
  - [ ] Toggle ON for `tickets` table
- [ ] Copy credentials:
  - [ ] Go to Settings → API
  - [ ] Copy Project URL
  - [ ] Copy `anon` public key

### Frontend Setup (Next.js)
- [ ] Clone/download project files
- [ ] Open terminal in project directory
- [ ] Run `npm install`
- [ ] Create `.env.local` file:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```
- [ ] Test locally:
  - [ ] Run `npm run dev`
  - [ ] Visit http://localhost:3000
  - [ ] Login with SW01
  - [ ] Create a test ticket
  - [ ] Login with T01
  - [ ] Complete the test ticket

### Vercel Deployment
- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Run `vercel` in project directory
- [ ] Follow prompts (accept defaults)
- [ ] Note the deployment URL
- [ ] Add environment variables in Vercel:
  - [ ] Go to Vercel dashboard
  - [ ] Click project → Settings → Environment Variables
  - [ ] Add `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Redeploy: `vercel --prod`
- [ ] Test production URL

### iPad Configuration
- [ ] Front iPad (Service Writer):
  - [ ] Open Safari, visit production URL
  - [ ] Add to Home Screen
  - [ ] Name: "Interstate Tickets - Front"
  - [ ] Open app from home screen
  - [ ] Login with SW01
  - [ ] Bookmark: /intake page
- [ ] Back iPad (Technicians):
  - [ ] Open Safari, visit production URL
  - [ ] Add to Home Screen
  - [ ] Name: "Interstate Tickets - Queue"
  - [ ] Open app from home screen
  - [ ] Login with T01
  - [ ] Bookmark: /queue page

### Optional: Guided Access (Kiosk Mode)
- [ ] On each iPad:
  - [ ] Settings → Accessibility → Guided Access
  - [ ] Toggle ON
  - [ ] Set passcode (e.g., 1234)
- [ ] Lock to app:
  - [ ] Open Interstate Tickets app
  - [ ] Triple-click Home/Side button
  - [ ] Tap "Start"
  - [ ] iPad now locked to this app

---

## Post-Deployment Verification

### Test Front iPad (Intake)
- [ ] Can login with SW01
- [ ] Can select each service type
- [ ] Form fields appear correctly
- [ ] Can set priority
- [ ] Can add notes
- [ ] Ticket creates successfully
- [ ] Toast notification appears
- [ ] Form clears after submit

### Test Back iPad (Queue)
- [ ] Can login with T01
- [ ] Queue shows pending tickets
- [ ] Tickets grouped by priority
- [ ] Can tap ticket to open detail
- [ ] Modal shows all info correctly
- [ ] Can select technician
- [ ] Can complete ticket
- [ ] Ticket disappears from queue

### Test Realtime Updates
- [ ] Create ticket on Front iPad
- [ ] Verify appears on Back iPad within 2 seconds
- [ ] Complete ticket on Back iPad
- [ ] Verify disappears immediately

### Test Admin Dashboard
- [ ] Can login with ADMIN
- [ ] Can add new technician
- [ ] Can deactivate technician
- [ ] Can delete technician
- [ ] KPIs display correctly

### Test Appointment Scheduling
- [ ] Create appointment for future time
- [ ] Verify does NOT appear in queue yet
- [ ] Wait until scheduled time
- [ ] Verify DOES appear in queue

---

## Production Data Setup

### Add Real Staff Members

```sql
-- In Supabase SQL Editor

-- Add service writers
INSERT INTO staff (id_code, name, role) VALUES
  ('SW01', 'Front Desk', 'SERVICE_WRITER'),
  ('SW02', 'Your Name', 'SERVICE_WRITER');

-- Add technicians
INSERT INTO staff (id_code, name, role) VALUES
  ('T01', 'Mike', 'TECHNICIAN'),
  ('T02', 'Jose', 'TECHNICIAN'),
  ('T03', 'Sarah', 'TECHNICIAN');

-- Sync to technicians table
INSERT INTO technicians (staff_id, name)
SELECT id, name FROM staff WHERE role = 'TECHNICIAN';

-- Add manager
INSERT INTO staff (id_code, name, role) VALUES
  ('ADMIN', 'Manager Name', 'MANAGER');
```

### Print ID Code Cards

Create laminated cards for staff:

```
┌─────────────────────┐
│ INTERSTATE TIRES    │
│ Job Ticket System   │
│                     │
│ Your Name           │
│ ID Code: SW01       │
│                     │
│ tickets.interstate  │
│ tire.online         │
└─────────────────────┘
```

---

## Monitoring & Maintenance

### Daily Checks
- [ ] Check ticket counts make sense
- [ ] Verify no stuck PENDING tickets
- [ ] Check Supabase project health

### Weekly Tasks
- [ ] Review completion metrics
- [ ] Check for any errors in logs
- [ ] Test both iPads working correctly

### Monthly Tasks
- [ ] Review and optimize database
- [ ] Check Supabase storage usage
- [ ] Update staff if needed

---

## Troubleshooting Common Issues

### Issue: Realtime not updating
**Fix:**
1. Check Supabase Realtime is enabled (Database → Replication)
2. Refresh the app
3. Check browser console for errors

### Issue: Login fails
**Fix:**
1. Verify environment variables are set
2. Check Supabase project is running
3. Verify ID code exists in database

### Issue: Tickets don't appear in queue
**Fix:**
1. Check ticket status is PENDING (not COMPLETED)
2. For appointments, check scheduled_time is in past
3. Check active_queue view in Supabase

### Issue: Can't complete ticket
**Fix:**
1. Verify technician is selected
2. Check technician exists and is active
3. Check RLS policies in Supabase

---

## Support Resources

- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs
- Tailwind Docs: https://tailwindcss.com/docs

---

## Success Criteria

✅ Both iPads can login with ID codes
✅ Front iPad can create all 7 service types
✅ Back iPad shows live queue with realtime updates
✅ Technicians can complete tickets
✅ Admin can manage technicians
✅ Appointments only appear at scheduled time
✅ System runs reliably for 8+ hours

---

## Emergency Rollback

If something breaks in production:

1. **Immediate**: Switch to paper tickets temporarily
2. **Check Logs**:
   - Vercel: Dashboard → Project → Logs
   - Supabase: Dashboard → Logs
3. **Rollback**:
   ```bash
   vercel rollback
   ```
4. **Contact Support** if needed

---

## Next Steps After Successful Deployment

1. Train staff on new system
2. Run parallel with old system for 1 week
3. Gather feedback
4. Plan Phase 2 features
5. Consider adding:
   - Print ticket functionality
   - Customer notifications
   - Inventory tracking integration

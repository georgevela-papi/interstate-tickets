# Interstate Tires Job Ticket System

Internal iPad web app for managing tire shop job tickets with real-time queue updates.

## Features

- **Two-Screen System**: Front iPad (Service Writers) + Back iPad (Technicians)
- **ID Code Authentication**: Fast login with simple codes (SW01, T01, etc.)
- **Real-time Queue**: Live updates when tickets are created/completed
- **Priority Management**: HIGH / NORMAL / LOW with visual indicators
- **Appointment Scheduling**: Time-aware appointments that appear in queue at scheduled time
- **Service Types**: Mount/Balance, Flat Repair, Rotation, New/Used Tires, Detailing, Appointments
- **Technician Management**: Admin can add/remove/deactivate technicians
- **Reporting KPIs**: Track daily/weekly completions, average time, queue status
- **iPad Optimized**: Large touch targets, responsive design, PWA-ready

## Tech Stack

- **Frontend**: Next.js 14 (React + TypeScript)
- **Backend**: Supabase (Postgres + Realtime + Auth)
- **Styling**: Tailwind CSS (Interstate Tires branding)
- **Deployment**: Vercel (frontend) + Supabase Cloud (backend)

---

## Quick Start (5 Minutes)

### 1. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (pick a name like "interstate-tickets")
3. Wait 2 minutes for project to initialize
4. Go to **SQL Editor** in the sidebar
5. Copy the contents of `supabase/migrations/001_initial_schema.sql`
6. Paste into SQL Editor and click **Run**
7. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key

### 2. Setup Next.js App

```bash
cd interstate-tickets

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run development server
npm run dev
```

Visit http://localhost:3000

### 3. Default Login Codes

- **SW01** - Service Writer (Front iPad - Create Tickets)
- **T01, T02, T03** - Technicians (Back iPad - Complete Jobs)
- **ADMIN** - Manager (Admin Dashboard)

---

## Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Settings → Environment Variables → Add:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY

# Redeploy
vercel --prod
```

### Configure Custom Domain (Optional)

1. In Vercel dashboard: Settings → Domains
2. Add: `tickets.interstatetire.online`
3. Follow DNS instructions from Vercel

---

## iPad Setup

### Install as Web App

1. Open the app URL in Safari on iPad
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Name it "Interstate Tickets"
5. Tap "Add"

### Lock iPad in Kiosk Mode (Guided Access)

For dedicated shop iPads:

1. Settings → Accessibility → Guided Access → On
2. Set a passcode
3. Open the Interstate Tickets app
4. Triple-click Home/Side button
5. Tap "Start" (locks to this app)

To exit: Triple-click Home/Side button, enter passcode

---

## Database Schema

### Tables

**staff** - All employees with ID codes
- `id_code`: Unique login code (SW01, T01, etc.)
- `name`: Full name
- `role`: SERVICE_WRITER | TECHNICIAN | MANAGER
- `active`: Boolean

**technicians** - Active technicians for job completion
- `name`: Technician name
- `active`: Boolean

**tickets** - Job tickets
- `ticket_number`: Auto-incrementing display number
- `service_type`: MOUNT_BALANCE | FLAT_REPAIR | etc.
- `priority`: LOW | NORMAL | HIGH
- `status`: PENDING | COMPLETED
- `vehicle`: Vehicle description
- `service_data`: JSONB with service-specific fields
- `scheduled_time`: For appointments only
- `completed_by`: Reference to technician
- `completed_at`: Completion timestamp

### Views

**active_queue** - Real-time queue for back iPad
- Filters: status = PENDING
- Excludes: Future appointments
- Sorts: Priority (HIGH → NORMAL → LOW), then created_at

---

## User Workflows

### Service Writer Workflow (Front iPad)

1. Login with ID code (SW01)
2. Select service type (big icon buttons)
3. Fill in vehicle + service details
4. Set priority (defaults to NORMAL)
5. Add optional notes
6. Click "Create Ticket"
7. Toast shows ticket number
8. Form clears, ready for next

### Technician Workflow (Back iPad)

1. Login with ID code (T01, T02, T03)
2. View live queue grouped by priority
3. Tap a ticket card
4. Modal shows full details
5. Select their name from dropdown
6. Click "Complete Job"
7. Ticket disappears from queue

### Manager Workflow (Admin Dashboard)

1. Login with ID code (ADMIN)
2. **Manage Technicians** tab:
   - Add new technicians
   - Deactivate/reactivate
   - Delete (with confirmation)
3. **Reports & KPIs** tab:
   - View today/week totals
   - Average completion time
   - Pending count

---

## Customization

### Add New Service Type

1. Edit `src/lib/types.ts`:
   ```typescript
   export type ServiceType = 
     | 'MOUNT_BALANCE'
     | 'YOUR_NEW_SERVICE';
   ```

2. Add field definition in `src/lib/utils.ts`:
   ```typescript
   YOUR_NEW_SERVICE: [
     {
       name: 'field_name',
       label: 'Field Label',
       type: 'text',
       required: true,
     },
   ],
   ```

3. Update database enum:
   ```sql
   ALTER TYPE service_type ADD VALUE 'YOUR_NEW_SERVICE';
   ```

### Change Brand Colors

Edit `tailwind.config.ts`:
```typescript
colors: {
  sky: {
    500: '#YOUR_COLOR', // Primary brand color
  },
},
```

### Add Staff Member

```sql
-- In Supabase SQL Editor
INSERT INTO staff (id_code, name, role) VALUES
  ('SW02', 'John Doe', 'SERVICE_WRITER');

-- If technician, also add to technicians table
INSERT INTO technicians (staff_id, name)
SELECT id, name FROM staff WHERE id_code = 'SW02';
```

---

## Reporting Queries

Run these in Supabase SQL Editor:

### Total jobs completed today
```sql
SELECT COUNT(*) 
FROM tickets 
WHERE status = 'COMPLETED' 
  AND completed_at >= CURRENT_DATE;
```

### Jobs by service type (this month)
```sql
SELECT 
  service_type,
  COUNT(*) as total
FROM tickets
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY service_type
ORDER BY total DESC;
```

### Average completion time (last 7 days)
```sql
SELECT 
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60), 1) as avg_minutes
FROM tickets
WHERE status = 'COMPLETED'
  AND completed_at >= CURRENT_DATE - INTERVAL '7 days';
```

### Jobs per technician (this week)
```sql
SELECT 
  t.name as technician,
  COUNT(*) as jobs_completed
FROM tickets tk
JOIN technicians t ON tk.completed_by = t.id
WHERE tk.status = 'COMPLETED'
  AND tk.completed_at >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY t.name
ORDER BY jobs_completed DESC;
```

---

## Troubleshooting

### Realtime not working

Check Supabase Realtime is enabled:
1. Supabase Dashboard → Database → Replication
2. Enable replication for `tickets` table
3. Restart the app

### Login fails

1. Check environment variables are set correctly
2. Verify Supabase project URL is accessible
3. Check browser console for errors
4. Verify staff member exists in database

### Tickets not appearing in queue

1. Check ticket status is PENDING
2. For appointments, verify scheduled_time is in past
3. Check browser console for SQL errors
4. Verify Row Level Security policies

---

## Phase 2 Features (Future)

- [ ] "Start Job" button (add IN_PROGRESS status)
- [ ] "Waiting" status (customer stepped out)
- [ ] Filters on queue (by service type, technician)
- [ ] Estimated completion time
- [ ] Full reporting dashboard with charts
- [ ] Edit ticket after creation
- [ ] Print ticket (PDF)
- [ ] Customer name for all services
- [ ] Sound notification for HIGH priority
- [ ] Multi-location support
- [ ] Photo upload (before/after)

---

## Support

For questions or issues:
- Check the [Supabase docs](https://supabase.com/docs)
- Check the [Next.js docs](https://nextjs.org/docs)
- Review the code comments

---

## License

Internal use only for Interstate Tires.

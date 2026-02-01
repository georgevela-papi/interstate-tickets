# Interstate Tires Ticket System - Quick Reference

## Login Codes

| Role | Code | What You Can Do |
|------|------|-----------------|
| Service Writer | SW01 | Create tickets |
| Technician | T01, T02, T03 | Complete jobs |
| Manager | ADMIN | Manage system + reports |

---

## Service Writer (Front iPad)

### Creating a Ticket

1. **Login** with your ID code (SW01)
2. **Pick service type** (tap icon):
   - 🔧 Mount/Balance
   - 🔧 Flat Repair
   - 🔄 Rotation
   - 🆕 New Tires
   - ♻️ Used Tires
   - ✨ Detailing
   - 📅 Appointment
3. **Fill in vehicle**: "2019 Honda Civic - Blue"
4. **Complete service details** (fields change per service)
5. **Set priority**:
   - LOW - Can wait
   - NORMAL - Regular (default)
   - HIGH - Urgent
6. **Add notes** (optional): Any special instructions
7. **Create Ticket** button
8. ✅ Success! Ticket number shown

---

## Technician (Back iPad)

### Completing a Job

1. **Login** with your ID code (T01, T02, or T03)
2. **View queue**:
   - 🔴 HIGH priority jobs first
   - ⚪ NORMAL priority jobs
   - 🔵 LOW priority jobs
3. **Tap a ticket** to open details
4. **Review job info**:
   - Vehicle
   - Service type
   - Special notes
5. **Select your name** from dropdown
6. **Complete Job** button
7. ✅ Done! Ticket removed from queue

### Tips
- Queue updates automatically (no refresh needed)
- Oldest jobs show first within each priority
- Timer shows how long job has been waiting

---

## Service Types Guide

### Mount/Balance
- **Fields**: Number of tires (1-4)
- **Example**: "Mount 4 new tires"

### Flat Repair
- **Fields**: Which tire (FL/FR/RL/RR)
- **Example**: "Fix flat on front left"

### Rotation
- **Fields**: Pattern (optional)
- **Example**: "Standard rotation"

### New Tires
- **Fields**: Size, Quantity (1-4), Brand (optional)
- **Example**: "225/65R17 × 4, Michelin"

### Used Tires
- **Fields**: Size, Quantity (1-4)
- **Example**: "225/65R17 × 2"

### Detailing
- **Fields**: Service level (Basic/Full)
- **Example**: "Full detail"

### Appointment
- **Fields**: Customer name, Phone, Scheduled time
- **Example**: "John Smith, 423-555-1234, 2:00 PM"
- **Note**: Won't show in queue until appointment time

---

## Priority Guide

| Priority | When to Use | Example |
|----------|-------------|---------|
| 🔴 HIGH | Customer waiting, urgent need | Flat tire, customer waiting in lobby |
| ⚪ NORMAL | Regular jobs, standard service | Most appointments, routine work |
| 🔵 LOW | Can wait, non-urgent | Detail jobs, future appointments |

---

## Common Questions

**Q: What if I make a mistake on a ticket?**
A: Ask manager to delete it from admin dashboard. Create a new one.

**Q: Can I see old completed tickets?**
A: Not yet - Phase 2 feature. Manager can run reports.

**Q: What if internet goes down?**
A: Switch to paper tickets temporarily. Tickets will sync when back online.

**Q: How do I log out?**
A: Click "Logout" button in top right corner.

**Q: Can I use this on my phone?**
A: System is designed for iPads. Phone screens too small.

**Q: What's my ID code?**
A: Check your printed card or ask manager.

---

## Manager (Admin Dashboard)

### Managing Technicians

1. **Login** with ADMIN code
2. **Click "Manage Technicians" tab**
3. **Add new**:
   - Type name
   - Click "Add Technician"
4. **Deactivate**:
   - Click "Deactivate" next to name
   - (Temporarily removes from dropdown)
5. **Delete**:
   - Click "Delete" next to name
   - Confirm deletion

### Viewing Reports

1. **Click "Reports & KPIs" tab**
2. **See today's stats**:
   - Jobs completed today
   - Jobs completed this week
   - Average completion time
   - Current pending count

---

## Emergency Contacts

**System Down?**
- Switch to paper tickets
- Contact: [Your IT contact]

**Supabase Issues?**
- Check: https://status.supabase.com

**Need Help?**
- Manager: [Manager phone]
- System Admin: [Admin contact]

---

## Tips for Success

✅ **Always fill in vehicle info clearly**
   - Good: "2019 Honda Civic - Blue"
   - Bad: "Honda"

✅ **Use notes field for special instructions**
   - "Customer wants factory torque spec"
   - "Waiting for tire delivery"

✅ **Set priority appropriately**
   - Don't overuse HIGH priority
   - NORMAL is fine for most jobs

✅ **Double-check before submitting**
   - Ticket number can't be changed once created
   - Vehicle, service, priority

✅ **Keep iPads charged**
   - Plug in overnight
   - Keep charger nearby

---

## Keyboard Shortcuts

- **Escape** - Close modal/dialog
- **Tab** - Next field
- **Shift+Tab** - Previous field
- **Enter** - Submit form (when button focused)

---

## iPad Tips

### Add to Home Screen
1. Safari → Share button
2. "Add to Home Screen"
3. Name it "Interstate Tickets"

### Kiosk Mode (Lock to App)
1. Settings → Accessibility → Guided Access
2. Triple-click Home button
3. Start Guided Access

### Restart App
1. Swipe up to close
2. Reopen from home screen
3. Or refresh page (Safari)

---

## Version Information

**Current Version**: 1.0.0 (MVP)
**Last Updated**: January 2026
**Support**: [Your contact email]

---

## Coming Soon (Phase 2)

- ⏱ Start/Stop timer for jobs
- 📝 Edit tickets after creation
- 🖨 Print ticket receipts
- 📊 Detailed reports dashboard
- 📷 Photo uploads (before/after)
- 🔔 Sound alerts for HIGH priority

---

**Need this printed?** Save as PDF and print for each iPad station.

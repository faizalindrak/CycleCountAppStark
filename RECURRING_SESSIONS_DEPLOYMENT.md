# 🚀 Recurring Sessions - Deployment Guide

## ✅ Implementasi Selesai!

Fitur recurring cycle count sudah selesai diimplementasi dan siap untuk di-deploy. Semua perubahan sudah di-commit dan push ke branch `claude/recurring-cycle-count-01PGbNZs8sWN2UQA9EdmMNRK`.

---

## 📋 Fitur yang Sudah Diimplementasi

### 1. **Tipe Session**
- ✅ **Regular Session** - Session biasa (one-time, immediate)
- ✅ **Scheduled Session** - Session terjadwal untuk tanggal tertentu di masa depan
- ✅ **Recurring Template** - Master template yang auto-generate session harian/mingguan/bulanan

### 2. **Recurring Patterns**
- ✅ **Daily** - Setiap hari
- ✅ **Weekly** - Pilih hari-hari tertentu dalam seminggu (e.g., Senin-Jumat)
- ✅ **Monthly** - Pilih tanggal-tanggal tertentu setiap bulan (e.g., tanggal 1 dan 15)

### 3. **Time Window**
- ✅ Valid From & Valid Until untuk kontrol waktu akses
- ✅ Session auto-close setelah waktu habis
- ✅ User tidak bisa input data di luar time window

### 4. **Auto-Generation**
- ✅ Session auto-generate untuk 30 hari ke depan dari recurring template
- ✅ Update master template akan update future sessions (yang belum lewat)
- ✅ Past sessions tidak terpengaruh update template

### 5. **User Interface**
- ✅ Admin Dashboard: Form lengkap untuk create recurring/scheduled sessions
- ✅ Admin Dashboard: Badge indicator (RECURRING TEMPLATE, SCHEDULED, AUTO-GENERATED)
- ✅ Admin Dashboard: Display info recurring config dan time window
- ✅ User Session Selection: Filter otomatis hide scheduled future sessions
- ✅ User Session Selection: Countdown timer menunjukan sisa waktu
- ✅ User Session Selection: Warning banner ketika mendekati closing time
- ✅ Counting Page: Access control mencegah save di luar time window

### 6. **Database**
- ✅ Migration script lengkap
- ✅ 5 Database functions untuk automation
- ✅ RLS policies untuk security
- ✅ Logging table untuk tracking generated sessions

---

## 🔧 Langkah Deployment

### Step 1: Run Database Migration

Jalankan migration script di Supabase SQL Editor:

```bash
# File: database/recurring_sessions_migration.sql
```

1. Login ke Supabase Dashboard
2. Buka SQL Editor
3. Copy paste isi file `database/recurring_sessions_migration.sql`
4. Execute

**Expected Result:**
- Kolom baru di table `sessions`
- Table `recurring_session_logs` created
- 5 functions created
- RLS policies updated

### Step 2: Setup Cron Jobs

Ada 3 opsi untuk cron job:

#### **Option A: Supabase pg_cron (Recommended)**

Jalankan di SQL Editor:

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Activate scheduled sessions (every hour)
SELECT cron.schedule(
    'activate-scheduled-sessions',
    '0 * * * *',
    $$SELECT public.activate_scheduled_sessions();$$
);

-- Job 2: Auto-close expired sessions (every 5 minutes)
SELECT cron.schedule(
    'auto-close-expired-sessions',
    '*/5 * * * *',
    $$SELECT public.auto_close_expired_sessions();$$
);

-- Job 3: Generate recurring sessions (daily at midnight)
SELECT cron.schedule(
    'generate-recurring-sessions',
    '0 0 * * *',
    $$
    SELECT public.generate_recurring_sessions(id, 30)
    FROM sessions
    WHERE is_recurring_template = true
        AND status = 'active';
    $$
);
```

Verify jobs:
```sql
SELECT * FROM cron.job;
```

#### **Option B: External Cron (Vercel/GitHub Actions)**

Lihat detail di file `database/recurring_sessions_cron_setup.md`

#### **Option C: Manual Trigger (Testing)**

Untuk testing, bisa manual trigger di Admin Dashboard atau SQL Editor:

```sql
-- Activate scheduled sessions
SELECT * FROM public.activate_scheduled_sessions();

-- Auto-close expired
SELECT * FROM public.auto_close_expired_sessions();

-- Generate for specific template
SELECT * FROM public.generate_recurring_sessions('template-uuid-here'::UUID, 30);
```

### Step 3: Deploy Frontend

Frontend changes sudah dalam commit. Tinggal deploy seperti biasa:

```bash
# Jika menggunakan Vercel
vercel --prod

# Atau build manual
npm run build
```

### Step 4: Testing

#### Test 1: Create Recurring Template

1. Login sebagai admin
2. Go to Admin Dashboard > Sessions
3. Click "Create Session"
4. Pilih "Recurring Template"
5. Set name: "Daily Cycle Count"
6. Recurrence: Daily
7. Time: 08:00 - 17:00
8. Status: Active
9. Save

**Expected:**
- Session created dengan badge "RECURRING TEMPLATE"
- Database auto-generate 30 sessions ke depan
- Check di database:
  ```sql
  SELECT * FROM sessions WHERE parent_session_id = 'template-uuid';
  ```

#### Test 2: Scheduled Session

1. Create new session
2. Pilih "Scheduled Session"
3. Set scheduled date: besok
4. Time: 09:00 - 15:00
5. Save

**Expected:**
- Session status = 'scheduled'
- Tidak muncul di user session selection hari ini
- Akan muncul besok setelah cron activate

#### Test 3: User View & Countdown

1. Login sebagai user
2. Go to session selection
3. Pilih session dengan time window

**Expected:**
- Countdown timer muncul
- Warning banner jika < 30 menit
- Session hilang setelah expired

#### Test 4: Access Control

1. Buka session yang punya time window
2. Coba save count di luar jam operasional

**Expected:**
- Error message: "Session has not started yet" atau "Session has expired"
- Data tidak tersimpan

---

## 📊 Monitoring

### Check Generated Sessions

```sql
-- View all generated sessions for next 7 days
SELECT
  s.name,
  s.status,
  s.scheduled_date,
  s.valid_from,
  s.valid_until,
  p.name as template_name
FROM sessions s
LEFT JOIN sessions p ON p.id = s.parent_session_id
WHERE s.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
  AND s.parent_session_id IS NOT NULL
ORDER BY s.scheduled_date;
```

### Check Recurring Templates

```sql
-- View all recurring templates
SELECT
  id,
  name,
  recurring_config,
  valid_from::TIME as start_time,
  valid_until::TIME as end_time,
  status
FROM sessions
WHERE is_recurring_template = true
ORDER BY name;
```

### Check Logs

```sql
-- View generation logs
SELECT
  l.*,
  m.name as master_name,
  g.name as generated_name,
  g.status as session_status
FROM recurring_session_logs l
JOIN sessions m ON m.id = l.master_session_id
JOIN sessions g ON g.id = l.generated_session_id
ORDER BY l.created_at DESC
LIMIT 50;
```

### Check Cron Execution

```sql
-- For pg_cron
SELECT
  jobid,
  jobname,
  schedule,
  command,
  last_run,
  next_run
FROM cron.job;

-- Check run history
SELECT *
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

---

## 🐛 Troubleshooting

### Problem: Sessions tidak ter-generate

**Solution:**
1. Check template status:
   ```sql
   SELECT * FROM sessions WHERE is_recurring_template = true;
   ```
2. Manual trigger:
   ```sql
   SELECT * FROM generate_recurring_sessions('template-uuid', 30);
   ```
3. Check cron job running:
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
   ```

### Problem: Countdown tidak muncul

**Solution:**
- Pastikan session punya `valid_from` dan `valid_until`
- Check browser console untuk errors
- Refresh page

### Problem: User masih bisa save setelah expired

**Solution:**
- Check RLS policies:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'counts';
  ```
- Pastikan migration sudah dijalankan
- Clear browser cache

### Problem: Template update tidak affect future sessions

**Solution:**
- Manual trigger:
  ```sql
  SELECT * FROM update_future_sessions_from_template('template-uuid');
  ```
- Check fungsi permissions:
  ```sql
  GRANT EXECUTE ON FUNCTION update_future_sessions_from_template TO authenticated;
  ```

---

## 📁 File Changes Summary

### New Files:
1. `database/recurring_sessions_migration.sql` - Database migration
2. `database/recurring_sessions_cron_setup.md` - Cron setup guide
3. `RECURRING_SESSIONS_DEPLOYMENT.md` - This file

### Modified Files:
1. `src/components/AdminDashboard.jsx`
   - SessionEditor: Added recurring/scheduled forms
   - SessionsManager: Added badges and info display

2. `src/components/SessionSelection.jsx`
   - Added CountdownTimer component
   - Added session filtering by time window
   - Added warning banner

3. `src/components/ItemsList.jsx`
   - Added time-based access control in handleSaveCount

---

## ✨ Cara Pakai (User Guide)

### Untuk Admin:

#### Membuat Recurring Template (Daily Cycle Count)
1. Login sebagai admin
2. Admin Dashboard > Sessions > Create Session
3. Pilih **"Recurring Template"**
4. Nama: "Daily Cycle Count"
5. Recurrence: **Daily**
6. Valid From: 08:00
7. Valid Until: 17:00
8. Status: Active
9. Save
10. Assign users & items seperti biasa

**Hasil:** Sistem auto-generate session setiap hari untuk 30 hari ke depan. Users hanya bisa isi dari jam 08:00-17:00.

#### Membuat Weekly Cycle Count (Senin & Kamis)
1. Create Session > Recurring Template
2. Recurrence: **Weekly**
3. Select Days: **Mon, Thu**
4. Time: 08:00 - 17:00
5. Save

**Hasil:** Session otomatis di-generate setiap Senin dan Kamis.

#### Membuat Monthly Cycle Count (Tanggal 1 & 15)
1. Create Session > Recurring Template
2. Recurrence: **Monthly**
3. Select Dates: **1, 15**
4. Time: 08:00 - 17:00
5. Save

**Hasil:** Session otomatis di-generate tanggal 1 dan 15 setiap bulan.

#### Advance Planning (One-time Future Session)
1. Create Session > **Scheduled Session**
2. Scheduled Date: Pilih tanggal di masa depan
3. Time: 08:00 - 17:00
4. Save

**Hasil:** Session akan muncul untuk user di tanggal yang ditentukan.

### Untuk User:

1. Login > Session Selection
2. Pilih session (yang ada countdown timer)
3. Perhatikan countdown - session akan otomatis tutup setelah waktu habis
4. Isi cycle count seperti biasa
5. Jika waktu habis, data tidak bisa disimpan

---

## 🎯 Next Steps (Optional Enhancements)

Fitur tambahan yang bisa di-develop nanti:
- [ ] Email notification ketika session baru generated
- [ ] Push notification untuk countdown warning
- [ ] Dashboard analytics untuk recurring sessions
- [ ] Bulk delete future sessions
- [ ] Clone recurring template
- [ ] Export recurring schedule to calendar (iCal)

---

## 📞 Support

Jika ada issue atau pertanyaan:
1. Check troubleshooting section di atas
2. Check database logs
3. Check browser console untuk frontend errors
4. Review migration script execution

---

**Deployment Status:** ✅ Ready to Deploy

**Branch:** `claude/recurring-cycle-count-01PGbNZs8sWN2UQA9EdmMNRK`

**Commit:** `feat: add recurring and scheduled cycle count sessions`

**PR Link:** https://github.com/faizalindrak/CycleCountAppStark/pull/new/claude/recurring-cycle-count-01PGbNZs8sWN2UQA9EdmMNRK

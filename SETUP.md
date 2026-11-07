# Iron 75: setup guide

About 20 minutes, no coding. You'll create a free Supabase project (accounts and database), put the app on GitHub Pages (free hosting), and connect the two.

## 1. Create the database (Supabase)

1. Go to **supabase.com**, sign up, and click **New project**. Name it `iron75`, set a strong database password (save it in your password manager), pick the region closest to you, and create it. Wait about a minute.
2. In the left sidebar open **SQL Editor → New query**. Open `schema.sql` from this folder, copy all of it, paste it in, and click **Run**. You should see "Success. No rows returned."
   - This creates the tables, the private photo storage bucket, and the security rules that keep every person's data visible only to them.
3. Open **Project Settings → API** (or the **Connect** button). Copy:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long string starting with `eyJ`), or the **publishable** key (`sb_publishable_…`)
   - Do **not** copy the `service_role` / secret key. It must never go in the app.

## 2. Connect the app

Open `config.js` in any text editor and paste the two values:

```js
SUPABASE_URL: "https://abcdxyz.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
USDA_API_KEY: ""   // optional, see step 5
```

The anon key is designed to be public. Your data is protected by the Row Level Security rules from step 1.

## 3. Put it online (GitHub Pages)

1. Sign up at **github.com**, click **New repository**, name it `iron75`, set it to **Public**, and create it.
2. Click **uploading an existing file**, select **all the files** in the `iron75-app` folder (Ctrl+A) and drag them in, then click **Commit changes**. There are no subfolders, so everything sits side by side.
3. Open **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute your app is live at `https://YOUR-USERNAME.github.io/iron75/`.

## 4. Tell Supabase your web address

In Supabase open **Authentication → URL Configuration**:
- **Site URL:** `https://YOUR-USERNAME.github.io/iron75/`
- **Redirect URLs:** add the same address.

This makes the confirm-email and reset-password links open your app.

### Email: important for inviting friends

Supabase's built-in email sender is only for testing and allows **just a few emails per hour**. Pick one:
- **Easiest:** **Authentication → Sign In / Providers → Email**: turn off **Confirm email**. Friends sign up and are in immediately. (Password reset emails still use the built-in sender.)
- **Best:** connect a real email service under **Authentication → Emails → SMTP Settings**. Resend, Postmark and SendGrid all have free tiers.

Also turn on **Leaked password protection** under Authentication → Policies if your plan includes it.

## 5. Optional: your own USDA key

Branded-food search uses USDA's shared demo key, which allows about 30 searches an hour across everyone. A free personal key raises that to 1,000 an hour. Get one at **fdc.nal.usda.gov/api-key-signup** and paste it into `USDA_API_KEY` in `config.js`, then re-upload that file.

## 6. Install on your iPhone

Open your app address in **Safari** → tap **Share** → **Add to Home Screen** → **Add**. Create your account and the setup walks you through your profile, equipment, program and challenge.

Send friends the same address, or use **More → Invite friends** in the app. Everyone makes their own login and sees only their own data.

## Updating the app later

1. Upload the changed files to the same GitHub repository (they replace the old ones).
2. Open `sw.js`, change `VERSION` (for example `iron75-v3.0.1`), and upload it too. That tells phones to pick up the new version.
3. If you changed `schema.sql`, run it again in the SQL Editor. It's safe to re-run.

## Free-tier limits

- Supabase free tier: 500 MB database, 1 GB file storage, 50,000 monthly active users. Photos are compressed to about 300 KB each, so 1 GB is roughly 3,000 photos. Upgrade to Pro ($25/month) when you outgrow that.
- Supabase **pauses free projects after 7 days with no activity**. Daily use keeps it awake. If it pauses, click **Restore** in the dashboard.
- Back up from **Database → Backups**, and anyone can download their own data from **More → Download my data**.

## What's inside

| Part | What it does |
|---|---|
| `library.js` | 130 exercises and conditioning drills tagged by equipment and movement, equipment presets, and the program generator (2–6 day splits, goals, experience, session length, 4-week blocks with deloads) |
| `foods.json` | 13,224 USDA-verified foods (SR Legacy + FNDDS) with 35 nutrients per 100 g and household portions |
| `food.js` | Food search (curated common foods + ranked USDA search), Open Food Facts and USDA Branded lookups, barcode scanning |
| `nutrition.js` | Calorie and macro targets, adult vitamin and mineral targets (DRIs), trend weight, adaptive expenditure |
| `core.js` | Progression, PR detection, streaks, the 75-day challenge, and the "Are you building?" analysis |
| `store.js` | Supabase sign-in, sync, offline queue, and private photo storage |
| `schema.sql` | Tables, Row Level Security, storage bucket and policies, and account deletion |

Food data: USDA FoodData Central (public domain); Open Food Facts (Open Database License); USDA Branded Foods via the FoodData Central API.

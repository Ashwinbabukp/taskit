# Deployment Guide for Taskit

Your project is ready to be deployed to **Vercel** (or any Next.js hosting provider).

---

## 1. Deploying to Vercel (Recommended & Free)

1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New Project"** and select **`Ashwinbabukp/taskit`**.
3. Under **Environment Variables**, copy the keys from your local `.env.local`:

| Variable Name | Description |
| :--- | :--- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your 16-character Google App Password |
| `EMAIL_FROM` | `"taskit" <your-email@gmail.com>` |
| `RESEND_API_KEY` | Your Resend API Key (from resend.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Publishable / Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Secret / Service role key |

4. Click **"Deploy"**!
5. In ~45 seconds, your live production website URL (e.g. `https://taskit-ashwin.vercel.app`) will be active.

---

## 2. Supabase Tables Setup (One-time)

If you haven't run the SQL script in your Supabase dashboard yet:
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **SQL Editor** on the left menu.
3. Open `supabase-setup.sql` in this repo, copy its contents, paste it into the SQL Editor, and click **Run**.
4. All tables (`users`, `sessions`, `tasks`, `journals`) will be created in PostgreSQL.

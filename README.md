# TeamPulse – Lencioni Survey App

A hosted survey tool for Patrick Lencioni's Five Dysfunctions of a Team assessment.
Supports multiple teams, partial question sets, anonymous responses, and a live results dashboard.

## Deploy to Vercel (5 minutes)

### 1. Put the files on GitHub

1. Go to [github.com](https://github.com) → click **New repository**
2. Name it `teampulse`, set it to **Public** (Vercel free tier requires public or you upgrade)
3. Click **Create repository**
4. Upload `index.html` and `vercel.json` to the repo (drag & drop on the GitHub page, then commit)

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign up** with your GitHub account
2. Click **Add New → Project**
3. Find and select your `teampulse` repository → click **Deploy**
4. Wait ~30 seconds — Vercel gives you a live URL like `https://teampulse-abc123.vercel.app`

### 3. Set up Supabase (free database)

1. Go to [supabase.com](https://supabase.com) → create a free project
2. Go to **SQL Editor** and run the SQL from Step 2 in the app setup wizard
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon public` key

### 4. Connect the app

Open your Vercel URL, enter your Supabase credentials in the setup wizard, and you're live.

## Sharing the survey

- **Admin tab**: add teams, select which questions to include, copy the shareable link
- **Shareable link**: encodes which questions are active — send different links to different teams
- Respondents need no login — just open the link and answer

## Features

- 37 Lencioni questions across 5 dimensions (Trust, Conflict, Commitment, Accountability, Results)
- Admin selects any subset of questions per survey session
- Multiple teams, each with their own responses
- Results dashboard: dimension averages per team, team comparison, individual response table
- All data stored in Supabase — accessible from any device

# 🧊 Ramsey Community Fridge Tracker

Stock & wastage tracker for community fridges. Track items in/out, wastage, generate reports, manage volunteers.

## Quick Deploy to Render (Free)

### 1. Set up Turso Database (Free)
1. Go to [turso.tech](https://turso.tech) and sign up
2. Click **Create Database** → name it `community-fridge`
3. Click on your database → **Generate Token** → copy both:
   - **Database URL** (starts with `libsql://...`)
   - **Auth Token**

### 2. Push to GitHub
1. Create a **new private repository** on GitHub
2. Upload all these files (or use git push)

### 3. Deploy on Render (Free)
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add **Environment Variables:**
   - `TURSO_DATABASE_URL` = your Turso URL
   - `TURSO_AUTH_TOKEN` = your Turso token
5. Click **Create Web Service** — wait for deploy

### 4. Custom Domain (Optional)
1. In Render → your service → **Settings** → **Custom Domains**
2. Add `ramseycommunityfridge.co.uk`
3. Update your DNS: add a CNAME record pointing to your Render URL

## Local Development
```bash
npm install
cp .env.example .env  # Edit with your Turso credentials
npm run dev
```

## Features
- 📥 Log items in (Fridge & Freezer)
- 📤 Record items taken out
- 🗑️ Track wastage with reasons
- 📊 Reports with CSV download
- 📦 Archive completed items to history
- 👥 Volunteer/initials management
- 🔄 CSV import/export for all data types
- ⚙️ Admin panel with test mode

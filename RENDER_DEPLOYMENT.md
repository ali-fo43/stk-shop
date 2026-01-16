# Deploy STK Shop to Render

## Step 1: Initialize Git Repository

Open PowerShell in your project root and run:

```powershell
cd c:\Users\pc\OneDrive\Desktop\stk-shop
git init
git add .
git commit -m "Initial commit - STK Shop ready for deployment"
```

If you get an error about git not being configured, run first:
```powershell
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `stk-shop`
3. Choose **Public** (easier for Render) or **Private**
4. **DO NOT** initialize with README, .gitignore, or license
5. Click **Create repository**

## Step 3: Push to GitHub

After creating the repository, you'll see commands. Run these in PowerShell:

```powershell
cd c:\Users\pc\OneDrive\Desktop\stk-shop
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stk-shop.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

✅ Your code is now on GitHub!

## Step 4: Create Render Account

1. Go to https://render.com
2. Click **Sign Up**
3. **Sign up with GitHub** (easier - click GitHub button)
4. Authorize Render to access your GitHub
5. ✅ Account created!

## Step 5: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **New +** button
3. Select **Web Service**
4. Under "Connect a repository", search for `stk-shop`
5. Click **Connect** next to your repository

## Step 6: Configure Web Service

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Name** | `stk-shop-api` |
| **Environment** | `Node` |
| **Plan** | `Free` |
| **Build Command** | `cd server && npm install` |
| **Start Command** | `cd server && npm start` |

Leave other settings as default.

## Step 7: Add Environment Variables

Click **Add Environment Variable** and add these one by one:

```
DB_HOST = aws-0-us-west-2.pooler.supabase.com
DB_USER = postgres.bwklmszudjthbvciaryk
DB_PASSWORD = alifouani123
DB_NAME = postgres
DB_PORT = 6543
JWT_SECRET = +3C01ztTYJ8PP1JxnKyKIsAZzwChbYHs92HmeQUGfspstx/6P8um8H5qqZc7uLmNNBrgo0+UgKf2vhT5sEBChA==
ADMIN_EMAIL = admin@staxllc.com
ADMIN_PASSWORD = Admin@12345
PORT = 5000
NODE_ENV = production
```

## Step 8: Deploy!

1. Click **Create Web Service**
2. Wait 3-5 minutes for deployment
3. You should see:
   - Status: **Live**
   - URL: `https://stk-shop-api.onrender.com` (or similar)

✅ Your API is deployed!

## Step 9: Test Your API

Go to: `https://your-service-name.onrender.com/api/test-db`

You should see a JSON response with your tables.

## Step 10: Update Frontend URLs

Now update your frontend files to use the Render API URL:

### In `public/app.js`:

Find:
```javascript
const res = await fetch("/api/products");
```

Keep it as is - it will work on Render!

But if you have any hardcoded localhost URLs, change them:
```javascript
// OLD
await fetch("http://localhost:5000/api/login")

// NEW
await fetch("https://your-service-name.onrender.com/api/login")
```

### In `public/employee.js`:
Same changes as above.

### In `public/login.js`:
Same changes as above.

## Step 11: Deploy Frontend to Render

You can also deploy your frontend on Render as a static site:

1. In Render dashboard, click **New +** → **Static Site**
2. Connect your GitHub repository
3. **Build Command**: (leave empty if no build needed)
4. **Publish Directory**: `public`
5. Click **Create Static Site**

This will host your website at a public URL!

## 🎉 You're Live!

Your website is now globally accessible:
- **API**: `https://stk-shop-api.onrender.com`
- **Frontend**: `https://your-static-site.onrender.com` (if deployed)

## Troubleshooting

### Deployment fails?
- Check build logs in Render dashboard
- Ensure all environment variables are set
- Verify your database is accessible

### API not working?
- Test: `https://your-service-name.onrender.com/api/test-db`
- Check environment variables are correct
- Verify Supabase connection

### Frontend not loading?
- Check that `public/` folder exists
- Make sure all routes point to your API URL

## Next: Monitor & Update

Your Render service will:
- Auto-redeploy when you push to GitHub
- Go to sleep after 15 mins of inactivity (free plan)
- Wake up on first request (takes ~30 seconds)

Upgrade to **Paid Plan** for always-on hosting!


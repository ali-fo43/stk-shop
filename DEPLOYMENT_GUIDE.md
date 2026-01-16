# STK Shop - Deployment Guide (Supabase + Render)

## ✅ Step 1: Database Migration to Supabase

### What we've done:
- ✅ Converted your code from MySQL to PostgreSQL
- ✅ Updated all database queries to use PostgreSQL syntax
- ✅ Updated schema.sql for PostgreSQL
- ✅ Changed driver from `mysql2` to `pg`
- ✅ Created .env file template

### Next Steps:

#### 1.1 Create Supabase Account
1. Go to https://supabase.com
2. Click **Sign Up** → Use GitHub or email
3. Verify your email

#### 1.2 Create New Supabase Project
1. After login, click **New Project**
2. **Project Name**: `stk-shop`
3. **Database Password**: Create a strong password (save it!)
4. **Region**: Choose closest to you
5. Click **Create new project** (wait 2-3 minutes)

#### 1.3 Get Connection Details
1. Go to **Settings** → **Database** (bottom-left menu)
2. Find **Connection string** section
3. Copy these details:
   - **Host**: `db.xxxxx.supabase.co`
   - **Database**: `postgres`
   - **User**: `postgres`
   - **Password**: Your password from step 1.2
   - **Port**: `5432`

#### 1.4 Update .env File (server/.env)
Fill in the values from step 1.3:

```
DB_HOST=db.xxxxx.supabase.co
DB_USER=postgres
DB_PASSWORD=your_actual_password_here
DB_NAME=postgres
DB_PORT=5432
JWT_SECRET=your_random_32_char_string_here
ADMIN_EMAIL=admin@staxllc.com
ADMIN_PASSWORD=Admin@12345
PORT=5000
NODE_ENV=production
```

#### 1.5 Create Database Tables in Supabase
1. Go to Supabase dashboard
2. Go to **SQL Editor** (left menu)
3. Click **New Query**
4. Copy the entire content from `server/schema.sql`
5. Paste it into the SQL editor
6. Click **Run**
7. ✅ Tables created!

#### 1.6 Test Local Connection
1. Update your `.env` file with Supabase details
2. Run: `node server.js`
3. You should see: `✓ Database connected successfully`

---

## 🚀 Step 2: Prepare for Render Deployment

### 2.1 Create GitHub Repository
1. Go to https://github.com/new
2. **Repository name**: `stk-shop`
3. Choose **Public** or **Private**
4. Click **Create repository**
5. Follow instructions to push your code

Commands to run in your project root:
```bash
git init
git add .
git commit -m "Initial commit - ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stk-shop.git
git push -u origin main
```

### 2.2 Create .gitignore (if not exists)
Create file: `.gitignore`
```
node_modules/
.env
.env.local
.DS_Store
uploads/
*.db
*.db-shm
*.db-wal
```

### 2.3 Root package.json
Create file: `package.json` (in root folder)
```json
{
  "name": "stk-shop",
  "private": true,
  "scripts": {
    "start": "cd server && npm start",
    "dev": "cd server && npm run dev"
  }
}
```

### 2.4 Create Render Configuration

Create file: `render.yaml` (in root folder)
```yaml
services:
  - type: web
    name: stk-shop-server
    env: node
    plan: free
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DB_HOST
        sync: false
      - key: DB_USER
        sync: false
      - key: DB_PASSWORD
        sync: false
      - key: DB_NAME
        sync: false
      - key: DB_PORT
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
      - key: PORT
        sync: false
      - key: PUBLIC_URL
        sync: false
```

---

## 🌍 Step 3: Deploy to Render

### 3.1 Create Render Account
1. Go to https://render.com
2. Click **Sign Up** → Use GitHub
3. Authorize Render to access your GitHub

### 3.2 Create New Web Service
1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. **Connect a repository**: Select your `stk-shop` repository
4. Click **Connect**

### 3.3 Configure Service
**Settings:**
- **Name**: `stk-shop-server`
- **Environment**: `Node`
- **Build Command**: `cd server && npm install`
- **Start Command**: `cd server && npm start`
- **Plan**: Free (for testing)

### 3.4 Add Environment Variables
Click **Add Environment Variable** and add all from your `.env`:

```
DB_HOST=db.xxxxx.supabase.co
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=postgres
DB_PORT=5432
JWT_SECRET=your_jwt_secret
ADMIN_EMAIL=admin@staxllc.com
ADMIN_PASSWORD=Admin@12345
PORT=5000
NODE_ENV=production
```

### 3.5 Deploy
1. Click **Create Web Service**
2. Wait for deployment (2-5 minutes)
3. ✅ Your API is live at: `https://your-service-name.onrender.com`

---

## 📝 Step 4: Update Frontend URLs

Update your frontend files to use the new API URL:

**In `public/app.js`, `public/employee.js`, `public/login.js`:**

Change:
```javascript
const API = "http://localhost:5000";
```

To:
```javascript
const API = "https://your-service-name.onrender.com";
```

Then use it in fetch calls:
```javascript
fetch(`${API}/api/products`)
```

---

## ✅ Checklist

- [ ] Supabase account created
- [ ] Supabase project created with PostgreSQL
- [ ] Database connection details saved
- [ ] .env file updated with Supabase details
- [ ] Database tables created via SQL Editor
- [ ] Local server tested with `node server.js`
- [ ] GitHub repository created and code pushed
- [ ] Render account created
- [ ] Web service deployed
- [ ] Environment variables set in Render
- [ ] Frontend URLs updated to use Render API
- [ ] Website deployed and working globally!

---

## 🆘 Troubleshooting

### Database Connection Fails
- Double-check Supabase credentials in .env
- Ensure DB_HOST includes `.supabase.co` domain
- Check port is 5432
- Verify SSL is enabled

### Render Deployment Fails
- Check build logs in Render dashboard
- Ensure start command is correct
- Verify all environment variables are set

### CORS Issues
- Add Render URL to CORS settings in server.js
- Update fetch URLs in frontend

---

## Next: Deploy Frontend!

Once backend is live, deploy your frontend to:
- Render Static Site
- Netlify
- Vercel
- Or any static hosting

Then update `public/app.js` to point to your Render API URL.


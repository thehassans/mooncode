# API Key Persistence Issue - Root Cause & Solution

## 🔴 Root Cause Analysis

### **Primary Issue: In-Memory Database**

Your application is using **MongoDB Memory Server** (in-memory database) instead of a persistent MongoDB instance. This is evident from:

```javascript
// backend/src/modules/config/db.js:25-33
if (useMemory) {
  console.warn('[mongo] Using in-memory MongoDB (USE_MEMORY_DB=true or MONGO_URI missing). Data will NOT persist.')
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(memUri);
  console.log('MongoDB connected (in-memory)');
}
```

**What this means:**
- All data is stored in RAM (temporary memory)
- When the server restarts, ALL data is lost
- API keys, settings, orders, users - everything disappears
- The database is recreated empty on each restart

### **Why is this happening?**

The code checks for `process.env.MONGO_URI`:
```javascript
const haveUri = !!process.env.MONGO_URI;
let useMemory = preferMemory || !haveUri;
```

**If `MONGO_URI` environment variable is missing**, it defaults to in-memory storage.

---

## ✅ Solution: Step-by-Step Fix

### **Step 1: Set Up Persistent MongoDB**

You have **three options**:

#### **Option A: MongoDB Atlas (Recommended - Free & Cloud)**

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account (M0 cluster - 512MB free forever)
3. Click "Create Database" → "Build a Database"
4. Choose "M0 Free" tier
5. Select a region closest to you
6. Create cluster (takes 3-5 minutes)
7. Create a database user:
   - Username: `admin`
   - Password: (generate secure password)
8. Add IP Address:
   - Click "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for testing) → `0.0.0.0/0`
   - Or add your server's specific IP
9. Get Connection String:
   - Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string:
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   - Replace `<password>` with your actual password

#### **Option B: Local MongoDB (For Development)**

1. Download MongoDB Community Server:
   - Windows: [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Install and start MongoDB service
3. Connection string will be:
   ```
   mongodb://localhost:27017/buysial
   ```

#### **Option C: Docker MongoDB (For Development)**

```bash
docker run -d -p 27017:27017 --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=yourpassword \
  mongo:latest
```

Connection string:
```
mongodb://admin:yourpassword@localhost:27017/buysial?authSource=admin
```

---

### **Step 2: Create .env File**

Create a file named `.env` in your backend directory:

```bash
# Path: c:\Users\buysial\Desktop\codebyhassan\backend\.env
```

Add this content:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/buysial?retryWrites=true&w=majority

# Optional: Explicit database name
DB_NAME=buysial

# Server Configuration
PORT=3000
NODE_ENV=production

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# API Keys (Optional - can store in DB instead)
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Facebook API (if using)
FACEBOOK_ACCESS_TOKEN=your-facebook-token
FACEBOOK_APP_ID=your-facebook-app-id

# Disable in-memory DB (important!)
USE_MEMORY_DB=false
```

**Important:** Replace placeholders with your actual values!

---

### **Step 3: Install dotenv (if not already installed)**

```bash
cd c:\Users\buysial\Desktop\codebyhassan\backend
npm install dotenv
```

---

### **Step 4: Load Environment Variables**

Check if your `backend/src/index.js` has this at the very top:

```javascript
import dotenv from 'dotenv';
dotenv.config();
```

If not, add it as the **first import**.

---

### **Step 5: Restart Backend Server**

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm start
```

Check the console output. You should see:

```
[mongo] connecting... { uri: 'mongodb+srv://***:***@cluster0.xxxxx.mongodb.net/...' }
MongoDB connected: { host: 'cluster0-shard-00-02.xxxxx.mongodb.net', db: 'buysial' }
```

✅ **NOT** this:
```
[mongo] Using in-memory MongoDB (USE_MEMORY_DB=true or MONGO_URI missing). Data will NOT persist.
```

---

### **Step 6: Verify Persistence**

1. Go to API Setup page
2. Enter Google Maps API Key
3. Click "Save API Key"
4. Refresh the page → Key should still show as masked (`••••`)
5. Restart the backend server
6. Refresh the page → Key should STILL be there

---

## 📊 Database vs .env File: Best Practices

### **For API Keys / Configuration:**

| Aspect | Database (MongoDB) | Environment File (.env) |
|--------|-------------------|-------------------------|
| **Security** | ✅ Good - Encrypted at rest in Atlas | ⚠️ Must be in `.gitignore`, risk of exposure |
| **Flexibility** | ✅✅ Can update via UI without restart | ❌ Requires server restart |
| **Multi-tenant** | ✅✅ Different keys per workspace/user | ❌ Single set of keys for all |
| **Backup** | ✅ Automatic with DB backups | ⚠️ Must manually backup |
| **Access Control** | ✅ Role-based access via UI | ⚠️ Server file system access needed |
| **Deployment** | ✅ No config changes needed | ⚠️ Must set env vars on each deployment |
| **Development** | ✅ Test with different keys easily | ⚠️ Must edit file each time |

### **Recommendation:**

**Use BOTH strategically:**

#### **Store in .env:**
- ✅ Database connection string (`MONGO_URI`)
- ✅ JWT secret
- ✅ Server port
- ✅ Environment mode (`NODE_ENV`)
- ✅ Default/fallback API keys for development

#### **Store in Database:**
- ✅ User-configurable API keys (Google Maps, Gemini)
- ✅ Feature toggles
- ✅ Application settings (branding, limits)
- ✅ Workspace-specific configurations
- ✅ Business logic settings

### **Your Current Setup (Recommended):**

```javascript
// Fallback to .env if DB is empty
const key = dbSettings?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY
```

This provides:
- User can set keys via UI → stored in DB
- If DB is empty, falls back to .env
- Best of both worlds

---

## 🔒 Security Best Practices

### **1. Never Commit .env to Git**

Add to `.gitignore`:
```
# Environment variables
.env
.env.local
.env.*.local
```

### **2. Use .env.example for Documentation**

Create `backend/.env.example`:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
PORT=3000
JWT_SECRET=change-this-to-random-secret
GEMINI_API_KEY=optional-fallback-key
GOOGLE_MAPS_API_KEY=optional-fallback-key
```

Commit this file (without real values) so team knows what's needed.

### **3. Encrypt Database Secrets**

For production, consider encrypting API keys before storing in DB:

```javascript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

### **4. Use Environment-Specific Settings**

```
.env.development  → Local testing
.env.staging      → Staging server
.env.production   → Production server
```

---

## 🚀 Production Deployment Checklist

- [ ] MongoDB Atlas cluster created and configured
- [ ] IP whitelist configured (server IPs or 0.0.0.0/0)
- [ ] Database user created with strong password
- [ ] `.env` file created with production credentials
- [ ] `.env` added to `.gitignore`
- [ ] Environment variables set on hosting platform (Heroku, Vercel, etc.)
- [ ] `USE_MEMORY_DB=false` explicitly set
- [ ] Database backups enabled
- [ ] Tested: Settings persist after server restart
- [ ] Tested: Settings persist after code deployment

---

## 🐛 Troubleshooting

### **Issue: Still using in-memory DB after adding MONGO_URI**

**Check:**
1. `.env` file is in correct directory (`backend/.env`)
2. `dotenv.config()` is called before any imports that use `process.env`
3. Server was restarted after creating `.env`
4. No typo in variable name (must be `MONGO_URI`, not `MONGODB_URI`)

### **Issue: Connection fails to MongoDB Atlas**

**Check:**
1. IP address is whitelisted (try `0.0.0.0/0` for testing)
2. Password doesn't contain special characters that need URL encoding
3. Connection string is correct (no extra spaces)
4. Network allows outbound connections to MongoDB (port 27017)

### **Issue: API keys save but don't load on refresh**

**Check:**
1. Console logs show "saved successfully"
2. MongoDB has data (use MongoDB Compass or Atlas UI to verify)
3. GET endpoint returns masked keys (`••••`)
4. Frontend is checking for masked keys correctly

---

## 📝 Summary

**The Problem:**
- Using in-memory MongoDB
- Data lost on server restart
- No persistent storage

**The Solution:**
1. Set up MongoDB Atlas (or local MongoDB)
2. Create `.env` file with `MONGO_URI`
3. Set `USE_MEMORY_DB=false`
4. Restart server
5. Verify persistence

**Best Practice:**
- Store connection strings in `.env`
- Store user-configurable settings in Database
- Never commit `.env` to Git
- Use both strategically for optimal security and flexibility

---

Need help? Check the console output when starting the server - it will tell you which database it's connecting to!

# Plesk Git Deployment Guide for moonCode

This guide explains how to set up automatic deployment from GitHub to your Plesk server.

## Prerequisites

1. **Plesk Git Extension** installed
2. **Node.js** installed on server (preferably via nodenv)
3. **PM2** installed globally for backend process management
4. **SSH access** to your Plesk server

## Initial Server Setup

### 1. Install Node.js (if not already installed)

```bash
# Via nodenv (recommended)
curl -fsSL https://github.com/nodenv/nodenv-installer/raw/master/bin/nodenv-installer | bash
nodenv install 24.0.0
nodenv global 24.0.0

# OR via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 24
nvm use 24
```

### 2. Install PM2 globally

```bash
npm install -g pm2
pm2 startup  # Follow the instructions to enable PM2 on boot
```

### 3. Create environment files

```bash
# Backend .env
cd /var/www/vhosts/yourdomain.com/httpdocs/backend
nano .env
```

Add your environment variables:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mooncode
JWT_SECRET=your-secret-key-here
NODE_ENV=production
ENABLE_WA=true
# Add other variables as needed
```

## Plesk Git Configuration

### Step 1: Add Repository in Plesk

1. Go to **Git** in Plesk sidebar
2. Click **"Add Repository"**
3. Fill in:
   - **Repository name**: mooncode
   - **Repository URL**: `https://github.com/thehassans/mooncode.git`
   - **Repository branch**: `main`
   - **Repository path**: `/httpdocs`

### Step 2: Configure Deployment Settings

1. **Deployment mode**: Select **"Automatic"**
2. **Server path**: `/httpdocs`
3. **Enable additional deployment actions**: ✅ Check this box
4. **Deploy actions**: Paste the following:

```bash
# Backend deployment
cd backend && npm ci --production && pm2 restart mooncode-backend || pm2 start src/index.js --name mooncode-backend

# Frontend deployment  
cd frontend && nodenv shell 24 && npm ci && npm run build

# Set permissions
find . -type f -exec chmod 644 {} \; && find . -type d -exec chmod 755 {} \;

echo "Deployment complete at $(date)"
```

### Step 3: Initial Deployment

1. Click **"Deploy"** button in Plesk Git interface
2. Monitor the deployment log for errors
3. Verify both backend and frontend are running

## Deployment Flow

When you push to GitHub `main` branch:

1. **Plesk pulls** latest code from GitHub
2. **Backend**:
   - Installs production dependencies (`npm ci --production`)
   - Restarts PM2 process
3. **Frontend**:
   - Sets Node.js version to 24
   - Installs dependencies (`npm ci`)
   - Builds production bundle (`npm run build`)
4. **Permissions** are set correctly

## Frontend Serving Options

### Option A: Serve from subdirectory (Recommended)

Configure Plesk to serve frontend from `/httpdocs/frontend/dist`:

1. Go to **Apache & nginx Settings**
2. Add to **Additional nginx directives**:

```nginx
location / {
    root /var/www/vhosts/yourdomain.com/httpdocs/frontend/dist;
    try_files $uri $uri/ /index.html;
}

location /api {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

location /socket.io {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### Option B: Copy dist to httpdocs root

Modify deploy actions to copy build output:

```bash
# Add this after frontend build
cp -r frontend/dist/* /var/www/vhosts/yourdomain.com/httpdocs/public_html/
```

## Verify Deployment

### Check Backend

```bash
pm2 list
pm2 logs mooncode-backend
curl http://localhost:5000/api/health  # If you have a health endpoint
```

### Check Frontend

```bash
ls -la /var/www/vhosts/yourdomain.com/httpdocs/frontend/dist
# Should see index.html, assets/, etc.
```

### Check Logs

```bash
# Plesk deployment logs
cat /var/www/vhosts/yourdomain.com/logs/git_deploy.log

# PM2 logs
pm2 logs mooncode-backend --lines 100
```

## Troubleshooting

### Issue: "nodenv: command not found"

**Solution**: Remove `nodenv shell 24` from deploy actions or install nodenv:
```bash
# Use system Node.js instead
cd frontend && npm ci && npm run build
```

### Issue: "pm2: command not found"

**Solution**: Install PM2 globally or use alternative process manager:
```bash
npm install -g pm2
# OR use systemd service
```

### Issue: Build fails with memory error

**Solution**: Increase Node.js memory limit:
```bash
cd frontend && NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Issue: Permission denied errors

**Solution**: Run after deployment:
```bash
cd /var/www/vhosts/yourdomain.com/httpdocs
chown -R username:psacln .
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
```

## Manual Deployment

If automatic deployment fails, deploy manually via SSH:

```bash
cd /var/www/vhosts/yourdomain.com/httpdocs
git pull origin main

# Backend
cd backend
npm ci --production
pm2 restart mooncode-backend

# Frontend
cd ../frontend
npm ci
npm run build
```

## Environment-Specific Configurations

### Production optimizations

Add to `frontend/.env.production`:
```env
VITE_API_BASE=https://yourdomain.com
NODE_ENV=production
```

Add to `backend/.env`:
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mooncode_production
```

## Rollback Procedure

If deployment breaks production:

```bash
cd /var/www/vhosts/yourdomain.com/httpdocs
git log --oneline -10  # Find last working commit
git reset --hard <commit-hash>
# Then re-run deployment commands
```

## Monitoring

Set up PM2 monitoring:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Save PM2 configuration
pm2 save
```

## Security Checklist

- ✅ `.env` files are in `.gitignore`
- ✅ MongoDB is not exposed publicly
- ✅ JWT secrets are strong and unique
- ✅ File permissions are correct (644 for files, 755 for dirs)
- ✅ SSL certificate is installed (via Plesk Let's Encrypt)
- ✅ Backend runs on localhost only (proxied via nginx)

## Support

For issues:
1. Check Plesk Git deployment logs
2. Check PM2 logs: `pm2 logs mooncode-backend`
3. Check nginx error logs: `/var/www/vhosts/yourdomain.com/logs/error_log`
4. Verify environment variables are set correctly

---

**Last updated**: October 2025

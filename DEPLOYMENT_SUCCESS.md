# ✅ Plesk Deployment Successfully Configured!

## Working Deployment Script

The following script is now configured in Plesk Git and working:

```bash
export PATH="/opt/plesk/node/24/bin:$PATH"; cd backend; npm ci --omit=dev; pkill -f "node.*src/index.js" 2>/dev/null || true; sleep 2; nohup node src/index.js > ../backend.log 2>&1 & echo "Backend PID: $!"; cd ../frontend; npm ci; npm run build; echo "✅ Deployment complete - Backend running in background"
```

## What It Does

1. **Sets Node.js 24 path** from Plesk's installation
2. **Backend deployment**:
   - Installs dependencies with `npm ci --omit=dev`
   - Kills old backend process (if exists)
   - Starts new backend process in background
   - Logs output to `backend.log`
3. **Frontend deployment**:
   - Installs dependencies
   - Builds production bundle with Vite

## Deployment Flow

```
Push to GitHub main branch
    ↓
Plesk pulls latest code
    ↓
Runs deployment script
    ↓
Backend restarts automatically
    ↓
Frontend rebuilds
    ↓
✅ Live on production
```

## Monitoring

### Check Backend Logs
```bash
tail -f /var/www/vhosts/hassanscode.com/httpdocs/backend.log
```

### Check if Backend is Running
```bash
ps aux | grep "node.*src/index.js"
```

### Manually Restart Backend (if needed)
```bash
cd /var/www/vhosts/hassanscode.com/httpdocs/backend
pkill -f "node.*src/index.js"
nohup node src/index.js > ../backend.log 2>&1 &
```

## Known Warnings (Safe to Ignore)

- **multer@1.4.5-lts.2 deprecated**: Update to multer 2.x when convenient
- **pkill: Operation not permitted**: Expected if old process owned by different user

## Next Steps (Optional Improvements)

### 1. Upgrade Multer (Security)
In `backend/package.json`, update:
```json
"multer": "^2.0.0"
```

### 2. Use PM2 for Better Process Management
Install PM2 globally via SSH (requires sudo):
```bash
sudo npm install -g pm2
```

Then update deploy script to use PM2 instead of nohup.

### 3. Set Up SSL Certificate
In Plesk:
- Go to "SSL/TLS Certificates"
- Click "Install" for Let's Encrypt
- Enable "Secure your website"

### 4. Configure nginx for Frontend
Ensure Plesk serves frontend from `httpdocs/frontend/dist`:

In Apache & nginx Settings → Additional nginx directives:
```nginx
location / {
    root /var/www/vhosts/hassanscode.com/httpdocs/frontend/dist;
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

## Troubleshooting

### Deployment fails
- Check Plesk Git deployment logs
- Verify Node.js 24 is installed: `node --version`
- Check backend logs: `cat backend.log`

### Backend not responding
- Check if process is running: `ps aux | grep node`
- Check backend logs for errors
- Verify MongoDB is running and accessible
- Check `.env` file has correct configuration

### Frontend not loading
- Verify build completed: `ls -la frontend/dist`
- Check nginx configuration
- Clear browser cache

---

**Deployment configured on**: October 11, 2025  
**Server**: hassanscode.com  
**Node.js version**: 24.9.0  
**Status**: ✅ Working

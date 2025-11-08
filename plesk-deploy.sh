#!/bin/bash

# Plesk Git Deployment Script for moonCode
# This script runs after git pull on the Plesk server
# Place this in the "Deploy actions" field in Plesk Git settings

set -e  # Exit on any error

echo "========================================="
echo "Starting deployment for moonCode"
echo "========================================="

# Navigate to repository root
REPO_ROOT="/var/www/vhosts/yourdomain.com/httpdocs"
cd "$REPO_ROOT"

echo "Current directory: $(pwd)"
echo "Git branch: $(git branch --show-current)"
echo "Last commit: $(git log -1 --oneline)"

# ==========================================
# BACKEND DEPLOYMENT
# ==========================================
echo ""
echo "========================================="
echo "Deploying Backend..."
echo "========================================="

cd "$REPO_ROOT/backend"

# Install backend dependencies
echo "Installing backend dependencies..."
npm ci --production

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "Warning: .env file not found in backend/"
    echo "Please create .env with required variables"
fi

# Restart backend service (adjust based on your PM2/systemd setup)
echo "Restarting backend service..."
if command -v pm2 &> /dev/null; then
    pm2 restart mooncode-backend || pm2 start src/index.js --name mooncode-backend
    echo "Backend restarted via PM2"
else
    echo "PM2 not found. Please restart backend manually or configure systemd service"
fi

# ==========================================
# FRONTEND DEPLOYMENT
# ==========================================
echo ""
echo "========================================="
echo "Deploying Frontend..."
echo "========================================="

cd "$REPO_ROOT/frontend"

# Set Node.js version using nodenv (if available)
if command -v nodenv &> /dev/null; then
    echo "Setting Node.js version to 24..."
    nodenv shell 24
    echo "Node version: $(node --version)"
else
    echo "nodenv not found, using system Node.js: $(node --version)"
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm ci

# Build frontend
echo "Building frontend for production..."
npm run build

# The build output (dist/) should be served by your web server
# Plesk typically serves from httpdocs, so you may need to:
# - Configure Plesk to serve from httpdocs/frontend/dist
# - OR copy dist contents to httpdocs root

echo "Frontend build complete. Output in: $(pwd)/dist"

# Optional: Copy dist to httpdocs root if needed
# Uncomment the following lines if you want to serve from root
# echo "Copying build to httpdocs root..."
# rm -rf "$REPO_ROOT/public_html"/*
# cp -r dist/* "$REPO_ROOT/public_html/"

# ==========================================
# POST-DEPLOYMENT TASKS
# ==========================================
echo ""
echo "========================================="
echo "Post-deployment tasks..."
echo "========================================="

# Clear any caches
echo "Clearing caches..."
# Add cache clearing commands if needed

# Set correct permissions
echo "Setting file permissions..."
cd "$REPO_ROOT"
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
chmod +x backend/src/index.js 2>/dev/null || true

# ==========================================
# DEPLOYMENT COMPLETE
# ==========================================
echo ""
echo "========================================="
echo "Deployment completed successfully!"
echo "========================================="
echo "Timestamp: $(date)"
echo "Backend: Running on PM2"
echo "Frontend: Built and ready"
echo "========================================="

exit 0

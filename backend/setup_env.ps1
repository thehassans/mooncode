# Setup environment file with new MongoDB credentials
$envContent = @"
# ============================================
# BuySial Commerce Backend - Environment Configuration
# ============================================

# Database Configuration
# ----------------------
# MongoDB Atlas Connection (Production Database)
MONGO_URI=mongodb+srv://Vercel-Admin-buysialsite:nl9hUXZxEZOyY0yJ@buysialsite.p0usujr.mongodb.net/?retryWrites=true&w=majority&appName=buysialsite

# Explicit database name
DB_NAME=Vercel-Admin-buysialsite

# Disable in-memory database (IMPORTANT - set to false for production)
USE_MEMORY_DB=false

# Server Configuration
# --------------------
PORT=3000
NODE_ENV=production

# CORS Configuration
# Allow multiple origins separated by comma, or use * for all
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:5174,http://localhost:57621,*

# Security
# --------
# JWT Secret for authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# Google Maps API (Optional)
GOOGLE_MAPS_API_KEY=

# Gemini AI API (Optional)
GEMINI_API_KEY=

# WhatsApp Integration (Optional)
ENABLE_WA=false

# File Upload Limits
MAX_FILE_SIZE=5mb

# Logging
LOG_LEVEL=info
"@

# Write to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline

Write-Host "✅ .env file created successfully!" -ForegroundColor Green
Write-Host "MongoDB URI configured for: Vercel-Admin-buysialsite database" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT: Update JWT_SECRET before deploying to production!" -ForegroundColor Yellow
Write-Host "Run: node -e `"console.log(require('crypto').randomBytes(32).toString('hex'))`"" -ForegroundColor Gray

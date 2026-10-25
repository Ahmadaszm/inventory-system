@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   QR Inventory System - Setup
echo ========================================
echo.
if not exist package.json (
  echo ERROR: Run this from the project folder.
  pause
  exit /b 1
)
if not exist .env (
  echo Creating .env file...
  (
    echo DATABASE_URL="postgresql://postgres.nmkscynewleihhopfoog:Ahmadaszm.12@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    echo DIRECT_URL="postgresql://postgres.nmkscynewleihhopfoog:Ahmadaszm.12@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
    echo NEXTAUTH_SECRET="inv-secret-2026-zmzm"
    echo NEXTAUTH_URL="http://localhost:3000"
  ) > .env
  echo .env created.
)
echo [1/4] npm install ...
call npm install
if errorlevel 1 ( echo npm install failed & pause & exit /b 1 )
echo [2/4] prisma generate ...
call npx prisma generate
if errorlevel 1 ( echo prisma generate failed & pause & exit /b 1 )
echo [3/4] prisma db push ...
call npx prisma db push
if errorlevel 1 ( echo db push failed & pause & exit /b 1 )
echo [4/4] seed data ...
call npx tsx prisma/seed.ts
if errorlevel 1 ( echo seed failed & pause & exit /b 1 )
echo Setup complete! Run start.bat
pause

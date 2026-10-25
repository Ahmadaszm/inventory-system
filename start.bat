@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting... http://localhost:3000
echo Login: admin@inventory.local / Admin@123
call npm run dev
pause

@echo off
echo Starting local development server with fixes...
echo.
echo Fixes applied:
echo - Fixed "No contracts found" issue when switching filters
echo - Improved data loading speed with parallel fetching
echo - Enhanced caching system (10min memory, 60min IndexedDB)
echo - Better error handling and progress messages
echo - Fixed partial data loading for immediate display
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak > nul
start http://localhost:3000
npm start
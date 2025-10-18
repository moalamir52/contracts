@echo off
echo Clearing cache and testing direct access...
echo.
echo Opening browser to clear cache...
start chrome --new-window --incognito http://localhost:3000
echo.
echo Or press F12 in browser and:
echo 1. Go to Application tab
echo 2. Clear Storage
echo 3. Click "Clear site data"
echo.
pause
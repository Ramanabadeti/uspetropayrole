@echo off
echo Pulling latest changes from GitHub...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo Git pull failed. Make sure no other update is running and try again.
  pause
  exit /b 1
)

echo.
echo Installing any new dependencies...
call npm install

echo.
echo Building the app...
call npm run build

echo.
echo Update complete. Starting the server...
echo If it is already running in another window, close that window first.
echo Press Ctrl+C here to stop the app.
echo.
call npm start

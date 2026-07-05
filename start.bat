@echo off
echo Installing any dependencies picked up by a git pull...
call npm install

echo.
echo Building the app...
call npm run build

echo.
echo Starting US Petro Payroll...
echo Open http://localhost:5050 in a browser once you see "Server running on port".
echo Press Ctrl+C here to stop the app.
echo.
call npm start

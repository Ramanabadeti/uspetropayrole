#!/bin/bash
set -e

echo "Building the app..."
npm run build

echo
echo "Starting US Petro Payroll..."
echo "Open http://localhost:5050 once you see \"Server running on port\"."
echo "Press Ctrl+C to stop the app."
echo
npm start

#!/bin/bash
set -e

echo "Pulling latest changes from GitHub..."
git pull --ff-only

echo
echo "Backing up the database before anything else..."
npm run backup

echo
echo "Installing any new dependencies..."
npm install

echo
echo "Building the app..."
npm run build

echo
echo "Update complete. Starting the server..."
echo "Any pending database migrations are applied automatically on startup."
echo "If it is already running elsewhere, stop that process first."
echo "Press Ctrl+C to stop the app."
echo
npm start

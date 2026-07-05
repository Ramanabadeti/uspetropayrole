#!/bin/bash
# Meant to be launched automatically at login (e.g. via a macOS Login Item
# or launchd), NOT run manually for updates. It only serves whatever was
# already built by start.sh/update.sh — it does not pull, install, or
# rebuild anything, so it starts quickly.
cd "$(dirname "$0")"
npm start

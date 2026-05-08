#!/bin/bash
set -e

echo ""
echo "  OT Frontend - Local Dev"
echo "  ---------------------------------"
echo "  URL     : http://localhost:3002"
echo "  Backend : http://localhost:8085"
echo "  Auth    : mock (no SSO needed)"
echo "  Press Ctrl+C to stop"
echo ""

if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed. Install from https://nodejs.org"
    exit 1
fi

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

npm run dev

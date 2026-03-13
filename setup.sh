#!/bin/bash

echo ""
echo "================================================"
echo "   < CODE SYNC > - QUICK SETUP SCRIPT"
echo "================================================"
echo ""

echo "[1/4] Installing root dependencies..."
npm install

echo ""
echo "[2/4] Installing server dependencies..."
cd server
npm install

echo ""
echo "[3/4] Installing client dependencies..."
cd ../client
npm install

echo ""
echo "[4/4] Setting up environment files..."
cd ../server
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Server .env file created"
fi

cd ../client
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Client .env file created"
fi

cd ..

echo ""
echo "================================================"
echo "    SETUP COMPLETE! "
echo "================================================"
echo ""
echo "To start the development servers:"
echo "  npm run dev"
echo ""
echo "Server will run on: http://localhost:3001"
echo "Client will run on: http://localhost:5173"
echo ""
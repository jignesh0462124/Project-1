@echo off
color 0a
title CODE SYNC - Demo Launcher

echo.
echo ██████╗  ██████╗ ██████╗ ███████╗    ███████╗██╗   ██╗███╗   ██╗ ██████╗
echo ██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
echo ██║     ██║   ██║██║  ██║█████╗      ███████╗ ╚████╔╝ ██╔██╗ ██║██║     
echo ██║     ██║   ██║██║  ██║██╔══╝      ╚════██║  ╚██╔╝  ██║╚██╗██║██║     
echo ╚██████╗╚██████╔╝██████╔╝███████╗    ███████║   ██║   ██║ ╚████║╚██████╗
echo  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝
echo.
echo        Real-time Collaborative Code Editor for Hackathons
echo        =====================================================
echo.
echo Starting both server and client...
echo.
echo Server: http://localhost:3001
echo Client: http://localhost:5173
echo.
echo Press Ctrl+C to stop both servers
echo.

start "CodeSync Server" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak > nul
start "CodeSync Client" cmd /k "cd client && npm run dev"

echo Both servers are starting...
echo.
echo 🎮 FEATURES:
echo   • Real-time collaborative editing
echo   • Up to 4 players per room  
echo   • 8 programming languages
echo   • Live cursors and chat
echo   • Retro gaming aesthetic
echo.
echo 🚀 USAGE:
echo   1. Wait for both servers to start (green messages)
echo   2. Open http://localhost:5173 in your browser
echo   3. Enter a username and create/join a room
echo   4. Share the Room ID with teammates
echo   5. Start coding together!
echo.
pause
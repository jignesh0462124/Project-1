# 🎮 < CODE SYNC > - Real-time Collaborative Code Editor

A retro gaming-themed collaborative code editor built for hackathons! Features real-time code synchronization, live cursors, chat, and supports up to 4 players per room.

![CodeSync Demo](https://via.placeholder.com/800x400/0d0d0d/00ff88?text=%3C+CODE+SYNC+%3E)

## ✨ Features

- 🕹️ **Retro Gaming Aesthetic** - "Press Start 2P" pixel font throughout
- 👥 **4-Player Rooms** - Maximum 4 developers per collaborative session
- 🔄 **Real-time Sync** - Code changes appear instantly across all clients
- 🎯 **Live Cursors** - See where other users are editing in real-time
- 💬 **In-room Chat** - Communicate with your team while coding
- 🔧 **8 Programming Languages** - JavaScript, TypeScript, Python, Java, C++, Go, Rust, HTML
- 👑 **Host System** - Room creator gets host privileges
- 📱 **Responsive Design** - Works on desktop and mobile devices
- ⚡ **Monaco Editor** - Full VS Code editor experience
- 🌐 **WebSocket Communication** - Built on Socket.io for real-time features

## 🧰 Tech Stack

### Frontend
- **React.js** with Vite
- **Monaco Editor** (@monaco-editor/react)
- **Socket.io-client** for WebSocket communication
- **TailwindCSS** for styling
- **React Hot Toast** for notifications
- **Lucide React** for icons
- **React Router Dom** for navigation

### Backend
- **Node.js** with Express.js
- **Socket.io** WebSocket server
- **UUID** for unique room ID generation
- **CORS** enabled for cross-origin requests

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm/yarn
- Modern web browser with WebSocket support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd codesync-app
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Set up environment variables**
   ```bash
   # Server
   cd ../server
   cp .env.example .env
   
   # Client
   cd ../client
   cp .env.example .env
   ```

5. **Start the development servers**

   **Terminal 1 (Server):**
   ```bash
   cd server
   npm run dev
   ```

   **Terminal 2 (Client):**
   ```bash
   cd client
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Create a room or join an existing one!

## 🎯 Usage

### Creating a Room
1. Enter your username (max 20 characters)
2. Click "CREATE ROOM"
3. Share the generated room ID with your team
4. Start coding together!

### Joining a Room
1. Enter your username
2. Click "JOIN ROOM"
3. Enter the room ID provided by the host
4. Join the collaborative session!

### Editor Features
- **Real-time Editing:** Code changes sync instantly
- **Language Switching:** Change programming language for all users
- **Live Cursors:** See where others are typing
- **Chat:** Communicate without leaving the editor
- **User Management:** See all connected users with color-coded avatars

## 🔌 Socket.io Events

### Client → Server
| Event | Data | Description |
|-------|------|-------------|
| `join-room` | `{ roomId, username }` | Join a collaborative room |
| `code-change` | `{ roomId, code }` | Broadcast code changes |
| `language-change` | `{ roomId, language }` | Change programming language |
| `cursor-move` | `{ roomId, username, position }` | Update cursor position |
| `chat-message` | `{ roomId, username, message }` | Send chat message |
| `leave-room` | `{ roomId, username }` | Leave the room |

### Server → Client
| Event | Data | Description |
|-------|------|-------------|
| `room-joined` | `{ users, code, language }` | Successfully joined room |
| `room-full` | `{ message }` | Room has reached 4-user limit |
| `user-joined` | `{ username, users }` | New user joined |
| `user-left` | `{ username, users }` | User left the room |
| `code-updated` | `{ code }` | Code was changed by another user |
| `language-updated` | `{ language }` | Programming language changed |
| `chat-received` | `{ username, message, timestamp }` | New chat message |
| `cursor-updated` | `{ username, position, color }` | User cursor moved |

## 🎨 Design System

### Color Palette
```css
Background:    #0d0d0d (near black)
Surface:       #1a1a2e (dark navy)  
Panel:         #16213e
Border:        #00ff88 (neon green)
Cyan:          #00d4ff
Text:          #e0e0e0
Accent:        #ff00ff (magenta)
Yellow:        #ffff00
```

### Typography
- **UI Font:** "Press Start 2P" (Google Fonts)
- **Code Font:** JetBrains Mono, Fira Code, Courier New

### User Colors
Each user gets assigned a unique neon color:
1. 🟢 Neon Green (`#00ff88`)
2. 🔵 Cyan (`#00d4ff`) 
3. 🟡 Yellow (`#ffff00`)
4. 🟣 Magenta (`#ff00ff`)

## 📁 Project Structure

```
codesync-app/
├── server/              # Node.js + Socket.io server
│   ├── index.js        # Main server file
│   ├── package.json    # Server dependencies
│   └── .env.example    # Environment variables template
├── client/             # React + Vite client
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx      # Landing/lobby page
│   │   │   └── Editor.jsx    # Main editor interface
│   │   ├── components/
│   │   │   ├── RoomHeader.jsx
│   │   │   ├── UserList.jsx
│   │   │   ├── ChatPanel.jsx
│   │   │   └── LanguageSelector.jsx
│   │   ├── styles/
│   │   │   └── pixel.css     # Retro gaming theme
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── socket.js         # Socket.io client config
│   ├── package.json
│   └── .env.example
└── README.md
```

## 🛠️ Development

### Server Development
```bash
cd server
npm run dev    # Start with nodemon for auto-restart
npm start      # Start production server
```

### Client Development
```bash
cd client
npm run dev    # Start Vite dev server
npm run build  # Build for production
npm run preview # Preview production build
```

### Environment Variables

**Server (.env)**
```env
NODE_ENV=development
PORT=3001
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Client (.env)**
```env
VITE_SOCKET_URL=http://localhost:3001
```

## 🚢 Deployment

### Server Deployment
1. Build the application: `npm run build` (client)
2. Deploy server to platforms like Heroku, Railway, or DigitalOcean
3. Set `NODE_ENV=production` in environment variables
4. Update `CORS_ORIGINS` with your client domain

### Client Deployment
1. Build: `npm run build`
2. Deploy to Netlify, Vercel, or similar static hosting
3. Set `VITE_SOCKET_URL` to your server URL

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/create-room` | Generate a new unique room ID |
| GET | `/api/health` | Server health check |

## 🎮 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send chat message / Join room |
| `Escape` | Close dropdowns |
| `Ctrl/Cmd + A` | Select all code |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |

## 🐛 Troubleshooting

### Common Issues

**"Failed to connect to server"**
- Ensure the server is running on port 3001
- Check firewall settings
- Verify `VITE_SOCKET_URL` in client `.env`

**"Room is full" error**
- Maximum 4 users per room
- Create a new room or wait for someone to leave

**"Username already taken"**
- Choose a different username
- Username must be unique within the room

**Code not syncing**
- Check network connection
- Ensure WebSocket connection is active (green dot in header)
- Try refreshing the page

## 🌟 Future Enhancements

- [ ] **Voice Chat** - Integrated voice communication
- [ ] **Code Execution** - Run code in sandboxed environment  
- [ ] **File Upload** - Import existing code files
- [ ] **Themes** - Multiple retro gaming themes
- [ ] **Room Persistence** - Save room state to database
- [ ] **User Authentication** - Login system with profiles
- [ ] **Replay System** - Record and replay coding sessions
- [ ] **Mobile App** - React Native companion app

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🏆 Built For

Perfect for:
- **Hackathons** 🏁
- **Pair Programming** 👥
- **Code Reviews** 🔍
- **Teaching/Learning** 📚
- **Technical Interviews** 💼
- **Team Collaborations** 🤝

---

**Made with ❤️ for the coding community**

*Start your collaborative coding journey today! Create a room and invite your team to experience the future of real-time code collaboration.*
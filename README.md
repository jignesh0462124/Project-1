# Collaborative Platform

Collaborative Platform is a real-time collaborative code editor for small coding sessions, interviews, teaching, pair programming, and hackathon teams. Users create or join a room, edit code together in Monaco Editor, chat in the same workspace, run supported code through JDoodle, and request AI code feedback through OpenRouter.

The application is split into a React/Vite client and a Node.js/Express server. Real-time collaboration is handled with Socket.io. Room data is currently stored in memory on the server, so it is fast to run locally and simple to deploy, but room state is not persisted after a server restart.

## What The Project Does

- Creates short room IDs for collaborative sessions.
- Allows up to 4 users per room.
- Synchronizes code changes between connected users.
- Synchronizes language changes and problem boilerplate.
- Shows remote cursor positions in Monaco Editor.
- Provides in-room chat.
- Assigns room ownership to the first user.
- Lets the owner pause, unpause, kick users, and transfer ownership.
- Includes a small DSA problem set with boilerplate code.
- Runs code through the JDoodle API for supported languages.
- Sends code and compiler output to OpenRouter for AI analysis.
- Supports dark and light UI themes.

## Tech Stack

### Client

- React 18
- Vite
- React Router
- Monaco Editor via `@monaco-editor/react`
- Socket.io client
- Tailwind CSS
- Lucide React icons
- React Hot Toast

### Server

- Node.js
- Express
- Socket.io
- Axios
- Helmet
- CORS
- Dotenv
- UUID

### External Services

- JDoodle: remote code execution.
- OpenRouter: AI code analysis, currently configured for `deepseek/deepseek-v4-flash`.

## Repository Layout

```text
collaborative-platform/
  client/
    index.html
    package.json
    vite.config.js
    tailwind.config.js
    src/
      App.jsx
      main.jsx
      socket.js
      pages/
        Home.jsx
        Editor.jsx
      components/
        AnalysisPanel.jsx
        ChatPanel.jsx
        LanguageSelector.jsx
        OutputPanel.jsx
        ProblemPanel.jsx
        RoomHeader.jsx
        ThemeContext.jsx
        ThemeToggle.jsx
        UserList.jsx
      constants/
        boilerplates.js
        languages.js
      styles/
        pixel.css
  server/
    index.js
    problems.js
    package.json
    .env.example
  package.json
  README.md
```

## Architecture

```text
Browser
  |
  | React app on Vite
  | - lobby
  | - editor
  | - chat
  | - room controls
  |
  | HTTP requests
  |   GET  /api/create-room
  |   GET  /api/problems
  |   POST /api/execute
  |   POST /api/analyze
  |
  | Socket.io events
  |   join-room
  |   code-change
  |   language-change
  |   cursor-move
  |   chat-message
  |   owner controls
  v
Node/Express server
  |
  | In-memory room store
  | rooms = Map<roomId, roomState>
  |
  | External APIs
  | - JDoodle for execution
  | - OpenRouter for analysis
```

### Room State

Each room is stored in memory with this shape conceptually:

```js
{
  users: [],
  code: "",
  language: "javascript",
  currentProblem: null,
  solvedProblems: Set,
  problemBoilerplates: {},
  cleanupTimeout: null
}
```

Because this is in-memory, empty rooms are deleted after a short cleanup timeout and all rooms are lost when the server restarts.

## Main User Flow

1. A user enters a display name and chooses a default language.
2. The user creates a room or joins an existing room.
3. The client connects to the Socket.io server.
4. The server creates the room if needed and sends the current room state.
5. The editor screen opens with users, chat, Monaco Editor, output, AI analysis, and problem controls.
6. Code changes are debounced on the client and broadcast to other room members.
7. The room owner can manage members and select/reset DSA problems.
8. Users can run code or ask for AI analysis from the editor toolbar.

## Getting Started

### Requirements

- Node.js 18 or newer
- npm
- A modern browser
- JDoodle credentials if you want code execution
- OpenRouter API key if you want AI analysis

### Install Dependencies

From the project root:

```bash
npm run install:all
```

Or install each package manually:

```bash
npm install
cd server
npm install
cd ../client
npm install
```

### Configure Environment Variables

Create server and client env files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

On Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

### Server Environment

`server/.env`:

```env
NODE_ENV=development
PORT=3001
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

JDOODLE_CLIENT_ID=your_client_id_here
JDOODLE_CLIENT_SECRET=your_client_secret_here

OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_APP_TITLE=Collaborative Platform
```

Do not commit real API keys. The local `server/.env` file should stay private.

### Client Environment

`client/.env`:

```env
VITE_SOCKET_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001
```

`VITE_SOCKET_URL` is used by the Socket.io client and lobby room creation. `VITE_API_URL` is used by the editor for code execution and AI analysis.

### Run In Development

From the project root:

```bash
npm run dev
```

This starts:

- Server: `http://localhost:3001`
- Client: `http://localhost:5173`

You can also run them separately:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

### Build The Client

```bash
npm run build
```

This runs the Vite production build from `client/`.

## API Reference

### `GET /api/create-room`

Creates an 8-character room ID.

Response:

```json
{
  "roomId": "ABC12345"
}
```

### `GET /api/health`

Returns server status and active room count.

Response:

```json
{
  "status": "ok",
  "rooms": 1,
  "timestamp": "2026-06-17T12:00:00.000Z"
}
```

### `GET /api/problems`

Returns the built-in DSA problem list from `server/problems.js`.

### `POST /api/execute`

Runs code through JDoodle.

Request:

```json
{
  "code": "console.log('hello')",
  "language": "javascript"
}
```

Supported execution languages:

- JavaScript
- TypeScript
- Python
- Java
- C++
- Go
- Rust

HTML is available as an editor language, but it is not sent to JDoodle for execution.

### `POST /api/analyze`

Sends code and optional compiler output to OpenRouter for AI feedback.

Request:

```json
{
  "code": "const x = 1 + 1;",
  "language": "javascript",
  "compilerOutput": "2"
}
```

Response:

```json
{
  "analysis": "Markdown-formatted feedback..."
}
```

The default model is controlled by `OPENROUTER_MODEL`.

## Socket.io Events

### Client To Server

| Event | Payload | Purpose |
| --- | --- | --- |
| `join-room` | `{ roomId, username, language }` | Join or create a room. |
| `code-change` | `{ roomId, code }` | Update room code and broadcast to others. |
| `language-change` | `{ roomId, language, code }` | Change language and optionally reset code. |
| `cursor-move` | `{ roomId, username, position }` | Broadcast cursor position to other users. |
| `chat-message` | `{ roomId, username, message }` | Send a room chat message. |
| `pause-user` | `{ roomId, targetUsername }` | Owner pauses a member. |
| `unpause-user` | `{ roomId, targetUsername }` | Owner unpauses a member. |
| `kick-user` | `{ roomId, targetUsername }` | Owner removes a member. |
| `transfer-ownership` | `{ roomId, targetUsername }` | Owner transfers room ownership. |
| `get-problems` | none | Request the problem list. |
| `select-problem` | `{ roomId, problemId }` | Owner selects a problem. |
| `select-random-problem` | `{ roomId }` | Owner selects a random unsolved problem. |
| `submit-solution` | `{ roomId, code, language }` | Submit current code for problem workflow feedback. |
| `mark-solved` | `{ roomId, problemId }` | Owner marks a problem solved. |
| `reset-problem` | `{ roomId }` | Reset current problem boilerplate. |
| `leave-room` | `{ roomId, username }` | Leave the room. |

### Server To Client

| Event | Payload | Purpose |
| --- | --- | --- |
| `room-joined` | `{ users, code, language, roomId }` | Initial room state for a joining user. |
| `room-full` | `{ message }` | Room rejected because it has 4 users. |
| `username-taken` | `{ message }` | Room rejected because the username already exists. |
| `user-joined` | `{ username, users, color, isHost }` | A new user joined. |
| `user-left` | `{ username, users, isKicked }` | A user left or was removed. |
| `code-updated` | `{ code }` | Another user changed the code. |
| `language-updated` | `{ language, code }` | Room language changed. |
| `cursor-updated` | `{ username, position, color }` | Remote cursor update. |
| `chat-received` | `{ username, message, timestamp }` | New chat message. |
| `action-blocked` | `{ message }` | A paused user tried to edit. |
| `user-paused` | `{ targetUsername, users }` | User pause state changed. |
| `user-unpaused` | `{ targetUsername, users }` | User pause state changed. |
| `user-kicked` | `{ targetUsername, users, kickedBy }` | User was removed by owner. |
| `kicked-from-room` | `{ roomId }` | Current user was kicked. |
| `ownership-transferred` | `{ newOwner, previousOwner, users }` | Owner changed manually. |
| `new-owner` | `{ newOwner, users }` | Owner changed because the previous owner left. |
| `problem-selected` | `{ problem, code, solvedBy }` | New problem selected. |
| `problem-solved` | `{ problemId, problemTitle, solvedBy, solvedProblems }` | Problem marked solved. |
| `problem-reset` | `{ code, problem }` | Problem code reset. |
| `submission-result` | `{ success, message, ... }` | Result of the submit action. |

## Frontend Structure

### Routes

- `/`: Lobby for creating or joining rooms.
- `/room/:roomId`: Main collaborative editor.

### Important Files

- `client/src/socket.js`: Socket.io singleton with reconnect handling.
- `client/src/pages/Home.jsx`: Lobby, username input, language selection, room creation/joining.
- `client/src/pages/Editor.jsx`: Main editor state, Socket.io event handling, code execution, AI analysis, responsive layout.
- `client/src/components/ChatPanel.jsx`: Room chat UI.
- `client/src/components/UserList.jsx`: Users, owner controls, paused state.
- `client/src/components/ProblemPanel.jsx`: DSA problem viewer and owner controls.
- `client/src/components/OutputPanel.jsx`: Code execution result display.
- `client/src/components/AnalysisPanel.jsx`: AI analysis result display.
- `client/src/styles/pixel.css`: Global theme tokens, dark/light mode styling, shared UI classes.

## Design And Theming

The app uses a polished retro developer-console style. The visual system is defined mostly in `client/src/styles/pixel.css`.

The theme system uses CSS variables for:

- Background
- Surface
- Panel
- Border
- Primary accent
- Secondary accent
- Text
- Warning/success colors
- Shadow treatment

Dark and light modes are controlled by `ThemeContext.jsx`, persisted in `localStorage`, and applied as a class on the document root.

## Deployment Notes

The client and server should be deployed separately.

### Client

The client is a static Vite build and can be deployed to Cloudflare Pages, Vercel, Netlify, or any static host.

```bash
cd client
npm run build
```

For Cloudflare Pages:

```bash
npm run deploy:cf
```

Set these client environment variables in the hosting dashboard:

```env
VITE_SOCKET_URL=https://your-server-domain.com
VITE_API_URL=https://your-server-domain.com
```

### Server

The server needs a Node.js host that supports WebSockets, such as Railway, Render, Fly.io, a VPS, or similar.

Set production server variables:

```env
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://your-client-domain.com
JDOODLE_CLIENT_ID=...
JDOODLE_CLIENT_SECRET=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
OPENROUTER_HTTP_REFERER=https://your-client-domain.com
OPENROUTER_APP_TITLE=Collaborative Platform
```

## Known Limitations

- Rooms are stored in memory, not a database.
- Room state is lost when the server restarts.
- There is no user authentication yet.
- Code execution depends on JDoodle limits and credentials.
- AI analysis depends on OpenRouter key, credits, rate limits, and model availability.
- Problem submission is currently a workflow signal, not a full automated judge against test cases.
- The server is designed for small rooms, currently capped at 4 users.

## Troubleshooting

### The client cannot connect to the server

- Make sure the server is running on `PORT=3001`.
- Check `client/.env`.
- Check `CORS_ORIGINS` in `server/.env`.
- Restart both client and server after changing env files.

### `OpenRouter rate limit reached`

The OpenRouter request reached the service, but the selected model or account is rate-limited or out of quota.

Fixes:

- Wait and try again later.
- Add credits to the OpenRouter account.
- Change `OPENROUTER_MODEL` to another available model.
- Restart the server after changing `.env`.

### `OpenRouter authentication failed`

The key was rejected.

Fixes:

- Check `OPENROUTER_API_KEY`.
- Make sure there are no extra spaces around the value.
- Restart the server after editing `.env`.

### Code execution fails

- Check `JDOODLE_CLIENT_ID` and `JDOODLE_CLIENT_SECRET`.
- Confirm the selected language is supported for execution.
- Check JDoodle usage limits.

### Room is full

Rooms are capped at 4 users. Create a new room or wait for someone to leave.

### Username is already taken

Usernames must be unique inside a room. Choose a different display name.

## Useful Commands

```bash
npm run dev
npm run build
npm run install:all
```

```bash
cd server
npm run dev
npm start
```

```bash
cd client
npm run dev
npm run build
npm run preview
npm run lint
```

## Development Notes

- Keep secrets in `.env` files only.
- Update `.env.example` when adding new environment variables.
- Keep Socket.io event names consistent between `server/index.js` and `client/src/pages/Editor.jsx`.
- Run `npm run build` before deploying the client.
- Restart the server after changing backend environment variables.

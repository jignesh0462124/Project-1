# CodeSync: Technical Architecture & Presentation Script

This document breaks down the technical implementation of CodeSync, specifically tailored for a technical presentation focusing on architecture, state management, and API integrations.

---

## 🎤 20-Second Technical Pitch (The "Elevator Arc")

> "CodeSync is a real-time collaborative development environment built on a Node and React stack. We handle low-latency collaboration using Socket.io for bi-directional event emission—syncing document state, editor cursors, and role-based permissions simultaneously without race conditions. We integrated the JDoodle API for isolated, multi-language code execution directly from the client, and we pipe the compiler output and AST directly into Google Gemini's Flash model for on-the-fly, AI-driven static analysis and runtime debugging."

*(Word count: 76 words. This reads at a brisk, confident technical pace and lands right around 20-22 seconds.)*

---

## 🏗️ Technical Architecture Breakdown

### 1. Real-Time State & WebSocket Layer (`Socket.io`)
- **Bi-directional event loops:** We use WebSockets to sync the `code-change`, `cursor-move`, and `chat-message` events in real-time. 
- **In-Memory Room Management:** The Node.js Express server maintains a simple in-memory `Map` data structure to track room IDs, active users, current language state, and the document buffer. 
- **Event Guards:** We instituted a role-based architecture on the WebSocket layer. The server validates `pause-user` and `action-blocked` socket events against the room's `isHost` property, allowing the room creator to lock down peer editors dynamically.

### 2. The Editor Core (`Monaco`)
- We utilize the `@monaco-editor/react` wrapper, which strips out VS Code's UI but gives us the raw power of its intelligent language service.
- State is bound reactively. We suppress circular WebSocket emissions by carefully distinguishing local keystrokes from server-broadcasted remote patches.

### 3. Remote Code Execution Engine
- Running arbitrary code on our node server is a massive security risk, so execution is pushed to an isolated Sandbox execution API (`JDoodle`).
- The frontend triggers a `POST /api/execute` request. Our Express backend acts as a secure proxy, attaching our `CLIENT_ID` and `SECRET` Server-Side to prevent exposing credentials to the client inspector, before returning the `stdout`/`stderr` payloads.

### 4. AI Code Analysis Pipe
- We built a direct pipeline into Google's **Gemini 2.0 Flash LLM**.
- When a user requests analysis, the Node server constructs a structured prompt combining the current Monaco Editor string buffer + the JDoodle compiler output buffer. 
- The LLM streams back parsed markdown highlighting AST issues, syntax errors, and algorithmic inefficiencies, which is rendered dynamically in our React frontend.

### Stack Summary
- **Client:** React, Vite, TailwindCSS, Lucide Icons, Monaco-React
- **Server:** Node.js, Express.js, Socket.io
- **Ext APIs:** JDoodle Code Execution Engine, Google Gemini AI (Flash)

# Fix: Cursor & Presence Jumping in Collaborative Editor

## Problem

In the real-time collaborative code editor, whenever any user types or edits code, every other user's cursor and selection decorations in Monaco jump, flicker, or reset to the wrong position. This is reproducible with 2+ users and gets worse with 4+ users in the same room.

## Architecture Context

The project is a React + Monaco Editor frontend (Editor.jsx, socket.js) connected to a Node.js Socket.IO backend (server/index.js) with Supabase for auth and persistence. Presence state — cursor positions and selection ranges — is stored in-memory on the server per user and rendered as Monaco decorations on the client. Key server functions involved are getUserPresence, getRoomPresence, and updateUserPresence. Key client functions are getPresenceKey, createPresenceMap, getSelectionPayload, getEditorPresencePayload, and the PresenceRail component.

## Root Causes to Investigate and Fix

The first root cause is that presence is being re-broadcast inside the code_change socket handler on the server. Every time any user sends a code change, the server is likely calling getRoomPresence and emitting the full presence snapshot back to all users in the room. This means every keystroke triggers a full presence re-render for every connected client, causing all cursors to jump simultaneously. This coupling between code sync and presence sync must be removed entirely.

The second root cause is that the client is emitting cursor presence inside Monaco's onDidChangeModelContent handler. This means every character typed sends a cursor_update event, flooding the server and causing all clients to re-render presence decorations on every keystroke. Cursor presence should only be emitted in response to actual cursor movement or selection change events, not content changes.

The third root cause is that when a user_presence_update arrives on the client, the entire presenceMap is being rebuilt using createPresenceMap and all Monaco decorations are being replaced at once. This causes every remote cursor to flicker on every single update from any user. Instead, only the specific user's decoration who actually moved should be updated.

The fourth root cause is that presence updates are being broadcast back to the sender using io.to(roomId) instead of socket.to(roomId), causing the local user to receive their own cursor update and potentially overwrite their live position with a stale one.

## What Needs to Change

On the server in index.js, completely decouple the presence system from the code_change handler. The code_change handler should only broadcast the new code to other users and do nothing with presence. Create a dedicated cursor_update handler that accepts a cursor position and optional selection range, validates both using the existing isValidCursorPosition and isValidSelectionRange validators, stores the update using updateUserPresence, and then broadcasts only that single user's updated presence as a delta event to all other users in the room using socket.to, not io.to. On socket disconnect, delete that user's presence from the in-memory store and emit a presence removal event to the rest of the room. On room join, send the full current presence snapshot only to the newly joining socket using socket.emit, not to the whole room.

On the client in Editor.jsx, remove any cursor or presence emission that exists inside the Monaco onDidChangeModelContent callback. Add cursor presence emission to the onDidChangeCursorPosition and onDidChangeCursorSelection Monaco events, throttled to fire at most once every 50 to 80 milliseconds to avoid flooding. Replace the existing presence_update listener that rebuilds the full presenceMap with a delta listener that patches only the single user entry that changed. Add a presence_snapshot listener to handle the initial full presence load when first joining a room. Add a user left listener to remove departed users' entries from the presenceMap and clean up their Monaco decorations. For Monaco decorations, maintain a ref keyed by userId that stores each remote user's active decoration IDs, and use deltaDecorations to update only one user's decorations at a time rather than replacing all decorations on every event.

In socket.js, ensure the SocketService always includes the authenticated userId from Supabase in every outgoing event payload so the server can correctly key presence by stable user identity rather than socket ID, which changes on reconnect.

## Success Criteria

After the fix, when any user types, all other users' cursors must remain completely stable in their last known positions. Cursor decorations should only move when the user they belong to actually moves their cursor or changes their selection. A newly joined user should immediately see all current room members' cursors. When a user disconnects, their cursor decoration should disappear for all other users. The fix must not introduce any visual regressions to the retro gaming pixel theme.

## Do Not

Do not call getRoomPresence inside the code_change handler. Do not emit full presence snapshots to the entire room on every cursor update. Do not use io.to when only socket.to should be used. Do not rebuild all Monaco decorations when only one user's presence changed. Do not emit cursor updates inside onDidChangeModelContent.

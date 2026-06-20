# 🔔 Feature 18 — Push & Email Notifications

> **Tier:** 3 — Nice to Have
> **Effort:** Medium-High (~2–3 days)
> **Dependencies:** Feature 01 (Auth — need user identity), Feature 02 (Database)
> **Unlocks:** Re-engagement, room activity awareness

---

## What & Why

Users want to know when:
- Someone joins their room
- They are mentioned in chat (`@username`)
- A room they care about becomes active again
- A problem they submitted gets reviewed

Without notifications, users must keep the tab open. With notifications, they can step away and come back.

---

## Implementation — Step by Step

### Part 1 — Choose Notification Channels

| Channel | Use Case | Tool |
|---|---|---|
| In-app toast | Immediate, same tab | react-hot-toast (already installed) |
| Browser Push | Background, system-level | Web Push API + VAPID |
| Email | Async, high-priority | Supabase Edge Functions + Resend |

Start with **in-app** (already done), then add **browser push**, then email.

---

### Part 2 — In-App Chat Mention Notifications

**Step 2.1** — In `ChatPanel.jsx`, detect `@username` mentions in incoming messages:

```jsx
socket.on('chat-received', ({ username, message, timestamp }) => {
  // Check if current user is mentioned
  if (message.includes(`@${currentUsername}`)) {
    toast(`💬 ${username} mentioned you in chat`, {
      duration: 5000,
      icon: '🔔',
    });
    // Also flash the chat panel indicator if it's hidden
    setHasMention(true);
  }
  addMessage({ username, message, timestamp });
});
```

**Step 2.2** — Highlight `@mentions` in message rendering:
```jsx
function renderMessage(message, currentUser) {
  return message.replace(
    new RegExp(`@${currentUser}`, 'gi'),
    `<span class="mention">@${currentUser}</span>`
  );
}
```

---

### Part 3 — Browser Push Notifications (Web Push API)

**Step 3.1** — Generate VAPID keys (one-time setup):
```bash
npx web-push generate-vapid-keys
```
Add to `server/.env`:
```env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_MAILTO=mailto:your-email@example.com
```

**Step 3.2** — Install web-push on server:
```bash
cd server
npm install web-push
```

**Step 3.3** — Create `server/services/pushService.js`:
```js
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPushNotification(subscription, title, body, url = '/') {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      url,
    }));
  } catch (err) {
    if (err.statusCode === 410) {
      // Subscription expired — delete from DB
      console.log('Push subscription expired:', err.endpoint);
    }
  }
}
```

**Step 3.4** — Add push subscription table to Supabase:
```sql
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT UNIQUE NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Step 3.5** — Add API route to save subscriptions:
```js
app.post('/api/push/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body;
  await supabase.from('push_subscriptions').upsert({
    user_id: req.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, { onConflict: 'endpoint' });
  res.json({ success: true });
});
```

**Step 3.6** — Add client-side subscription request in `client/src/utils/pushNotifications.js`:
```js
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });

  // Send subscription to server
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ...` },
    body: JSON.stringify(subscription.toJSON()),
  });

  return subscription;
}
```

**Step 3.7** — Create a basic Service Worker at `client/public/sw.js`:
```js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    data: { url: data.url },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

**Step 3.8** — Register Service Worker in `client/src/main.jsx`:
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
```

---

### Part 4 — Email Notifications (Supabase + Resend)

**Step 4.1** — Sign up for [Resend](https://resend.com) — free tier: 3,000 emails/month.

**Step 4.2** — Create a Supabase Edge Function `supabase/functions/send-notification/index.ts`:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { to, subject, html } = await req.json();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
    },
    body: JSON.stringify({
      from: 'Collaborative Platform <noreply@yourdomain.com>',
      to,
      subject,
      html,
    }),
  });

  return new Response(JSON.stringify(await res.json()), { status: res.status });
});
```

---

### Part 5 — Notification Preferences

**Step 5.1** — Add a notification preferences section to the Profile/Dashboard page:

```jsx
function NotificationSettings() {
  const [prefs, setPrefs] = useState({
    mentions: true,
    roomJoins: false,
    problemSolved: true,
    emailDigest: false,
  });

  return (
    <div className="notification-prefs">
      <h3>🔔 Notification Preferences</h3>
      {Object.entries(prefs).map(([key, val]) => (
        <label key={key}>
          <input type="checkbox" checked={val} onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))} />
          {key === 'mentions' && 'Notify me when someone @mentions me in chat'}
          {key === 'roomJoins' && 'Notify me when someone joins my room'}
          {key === 'problemSolved' && 'Notify me when a problem is solved'}
          {key === 'emailDigest' && 'Weekly email digest of my activity'}
        </label>
      ))}
      <button onClick={subscribeToPush}>Enable Browser Notifications</button>
    </div>
  );
}
```

---

### Part 6 — Testing Checklist

- [ ] @mention in chat → toast appears for mentioned user
- [ ] @mention highlighted in blue in chat message
- [ ] Browser push permission prompt appears when "Enable" clicked
- [ ] Push notification fires when tab is in background and user joins room
- [ ] Clicking push notification opens the correct room URL
- [ ] Email sent when subscribed user is mentioned (via Edge Function)
- [ ] Unsubscribe from browser push removes subscription from DB

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/utils/pushNotifications.js` | NEW |
| `client/public/sw.js` | NEW (Service Worker) |
| `server/services/pushService.js` | NEW |
| `server/index.js` | MODIFY (subscribe route, trigger push on events) |
| `server/.env` / `.env.example` | MODIFY (VAPID keys) |
| `client/.env` / `.env.example` | MODIFY (VITE_VAPID_PUBLIC_KEY) |
| `client/src/pages/Dashboard.jsx` | MODIFY (notification prefs section) |
| `client/src/components/ChatPanel.jsx` | MODIFY (mention detection) |
| Supabase SQL Editor | ADD push_subscriptions table |
| Supabase Edge Functions | ADD send-notification function |

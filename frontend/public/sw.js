/**
 * TransitIQ — Service Worker
 * ============================
 * Runs in the background to receive push notifications.
 * Placed in /public so it's served from the root.
 */

const CACHE_NAME = "transitiq-v1";

// ── Install ───────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing TransitIQ Service Worker");
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating TransitIQ Service Worker");
  event.waitUntil(clients.claim());
});

// ── Push Notification Received ────────────────────────────────
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");

  let data = {
    title:  "TransitIQ Alert",
    body:   "Delay detected on your route",
    icon:   "/favicon.ico",
    badge:  "/favicon.ico",
    url:    "/",
  };

  // Parse push data if available
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body:    data.body,
    icon:    data.icon,
    badge:   data.badge,
    vibrate: [200, 100, 200],
    tag:     "transitiq-delay",   // replaces previous notification
    renotify: true,
    data:    { url: data.url },
    actions: [
      { action: "view",    title: "View Routes" },
      { action: "dismiss", title: "Dismiss"     },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click ─────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || "/");
        }
      })
  );
});

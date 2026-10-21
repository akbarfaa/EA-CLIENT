// Service Worker for XAUUSDc Observability Terminal & Push Notifications
const CACHE_NAME = "xau-ea-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notification received in background
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "XAUUSD EA Notification";
    const options = {
      body: data.body || "",
      icon: "/logo.svg",
      badge: "/logo.svg",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/",
        timestamp: Date.now()
      },
      actions: [
        { action: "view", title: "Buka Terminal" }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("SW push error:", err);
  }
});

// Handle clicking on notification (Desktop or Mobile)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* eslint-disable no-restricted-globals */
// Rayons.net — Mobile & Web Push Service Worker (Foreground, Background & Bound-Account Support)

const BOUND_CACHE_NAME = "rayons-bound-device-v1";
const BOUND_CACHE_KEY = "/__rayons_bound_account__";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function saveBoundAccountToSwCache(accountData) {
  try {
    const cache = await caches.open(BOUND_CACHE_NAME);
    await cache.put(
      BOUND_CACHE_KEY,
      new Response(JSON.stringify(accountData || {}), {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (e) {
    // Ignore cache errors
  }
}

async function loadBoundAccountFromSwCache() {
  try {
    const cache = await caches.open(BOUND_CACHE_NAME);
    const res = await cache.match(BOUND_CACHE_KEY);
    if (!res) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// 1. Handle Push Events (Firebase Cloud Messaging / Web Push)
self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        notification: {
          title: "Rayons.net",
          body: event.data.text(),
        },
      };
    }
  }

  const notif = payload.notification || payload.data || payload;
  const title = notif.title || "Rayons.net";
  const body = notif.body || notif.message || "Vous avez reçu une nouvelle notification.";
  const url =
    (payload.data && (payload.data.url || payload.data.link)) ||
    (payload.fcmOptions && payload.fcmOptions.link) ||
    notif.click_action ||
    notif.link ||
    "/";
  const tag = (payload.data && payload.data.tag) || notif.tag || `rayons-${Date.now()}`;

  const options = {
    body,
    icon: "/icon-512.png",
    badge: "/icon.png",
    vibrate: [200, 100, 200],
    tag,
    renotify: true,
    requireInteraction: false,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Handle Direct Client & Bound-Account Notification Triggers
self.addEventListener("message", (event) => {
  const data = event.data || {};

  if (data.type === "SYNC_BOUND_ACCOUNT" && data.account) {
    event.waitUntil(saveBoundAccountToSwCache(data.account));
    return;
  }

  if (data.type === "SHOW_PUSH_NOTIFICATION") {
    const title = data.title || "Rayons.net";
    const body = data.body || "";
    const url = data.url || "/";
    const tag = data.tag || `rayons-local-${Date.now()}`;

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/icon-512.png",
        badge: "/icon.png",
        vibrate: [200, 100, 200],
        tag,
        renotify: true,
        data: { url },
      })
    );
  }
});

// 3. Handle Notification Click -> Deep Link Navigation
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            await client.focus();
            if ("navigate" in client && targetUrl) {
              try {
                await client.navigate(targetUrl);
              } catch (e) {
                // Ignore cross-origin navigate error if any
              }
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

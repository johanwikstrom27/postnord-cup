self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}

  const title = data.title || "PostNord Cup";
  const body = data.body || "";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/pncuplogga-v4.png", // eller din app-ikon
      badge: "/icons/pncuplogga-v4.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of allClients) {
        if (c.url.includes(self.location.origin)) {
          c.focus();
          c.postMessage({ type: "OPEN_URL", url });
          return;
        }
      }
      await clients.openWindow(url);
    })()
  );
});
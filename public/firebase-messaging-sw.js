// Service worker for Firebase Cloud Messaging background notifications.
// Firebase config is intentionally hardcoded here — service workers cannot
// access Next.js env vars, and Firebase web config is a public identifier (not a secret).
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDWQcGu55CPih-OLKipZSgaxfHOgXv65CE",
  authDomain: "hotel-agrawal-inn.firebaseapp.com",
  projectId: "hotel-agrawal-inn",
  storageBucket: "hotel-agrawal-inn.firebasestorage.app",
  messagingSenderId: "403124386354",
  appId: "1:403124386354:web:949d28c21362ebdb235a2b",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Hotel Agrawal Inn";
  const body = payload.notification?.body ?? "";
  self.registration.showNotification(title, {
    body,
    icon: "/logo.jpeg",
    badge: "/logo.jpeg",
    data: { link: payload.fcmOptions?.link ?? payload.data?.link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link;
  if (link) {
    event.waitUntil(clients.openWindow(link));
  }
});

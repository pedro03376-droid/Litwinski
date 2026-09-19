// Firebase Messaging Service Worker
// Handles FCM push messages when the app is in background/closed

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCtqk0eP9a3ZlLF__OaWS2jUJuN2KgH10o",
  authDomain: "gkhub-4717d.firebaseapp.com",
  databaseURL: "https://gkhub-4717d-default-rtdb.firebaseio.com",
  projectId: "gkhub-4717d",
  storageBucket: "gkhub-4717d.firebasestorage.app",
  messagingSenderId: "338475414522",
  appId: "1:338475414522:web:d9f5e20ea1f583dd392a43"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage(payload => {
  const { title = 'GK Hub', body = '' } = payload.notification || {};
  return self.registration.showNotification(title, {
    body,
    tag: payload.data?.tag || 'gkhub-fcm',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: payload.data?.url || './' }
  });
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

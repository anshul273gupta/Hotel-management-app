const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get all registered device tokens from Firestore
// ─────────────────────────────────────────────────────────────────────────────
async function getAllTokens() {
  const snapshot = await db.collection("fcm_tokens").get();
  return snapshot.docs.map((d) => d.id).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: send FCM to a list of tokens
// ─────────────────────────────────────────────────────────────────────────────
async function sendToTokens(tokens, title, body, link = "/") {
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    token,
    notification: { title, body },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "hotel_notifications",
        icon: "ic_notification",
        color: "#10b981",
        clickAction: "FLUTTER_NOTIFICATION_CLICK",
      },
    },
    apns: {
      payload: {
        aps: { sound: "default", badge: 1 },
      },
    },
    data: {
      link: String(link),
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
  }));

  // Send in batches of 500 (FCM limit)
  const batchSize = 500;
  const results = [];
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const result = await messaging.sendEach(batch);
    results.push(result);

    // Remove invalid tokens from Firestore automatically
    result.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          const deadToken = batch[idx].token;
          db.collection("fcm_tokens").doc(deadToken).delete().catch(() => {});
        }
      }
    });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 1: Send notification when a new push_queue document is created
// This fires the moment the Next.js app writes a notification — even if
// the laptop is then turned off, this function is already running on Google's
// servers and will deliver the FCM message.
// ─────────────────────────────────────────────────────────────────────────────
exports.sendPushOnCreate = onDocumentCreated(
  "push_queue/{docId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { title, body, link } = data;
    if (!title || !body) return;

    const tokens = await getAllTokens();
    await sendToTokens(tokens, title, body, link);

    // Clean up the queue document after sending
    await event.data.ref.delete().catch(() => {});
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 2: Scheduled check every 15 minutes — runs on Google's servers
// 24/7 completely independent of your laptop.
// Sends payment reminders and auto-checkout alerts stored in Firestore.
// ─────────────────────────────────────────────────────────────────────────────
exports.scheduledAlerts = onSchedule("every 15 minutes", async () => {
  const tokens = await getAllTokens();
  if (tokens.length === 0) return;

  const now = new Date();

  // Check for any scheduled alerts in Firestore
  const alertsSnap = await db
    .collection("scheduled_alerts")
    .where("sendAt", "<=", admin.firestore.Timestamp.fromDate(now))
    .where("sent", "==", false)
    .limit(50)
    .get();

  for (const doc of alertsSnap.docs) {
    const alert = doc.data();
    await sendToTokens(tokens, alert.title, alert.body, alert.link);
    await doc.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 3: Token registered — welcome notification to confirm setup works
// ─────────────────────────────────────────────────────────────────────────────
exports.onTokenRegistered = onDocumentCreated(
  "fcm_tokens/{token}",
  async (event) => {
    const token = event.params.token;
    if (!token) return;

    await messaging.send({
      token,
      notification: {
        title: "Hotel Agrawal Inn",
        body: "Notifications are active. You will receive alerts 24/7.",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "hotel_notifications",
          icon: "ic_notification",
          color: "#10b981",
        },
      },
    });
  }
);

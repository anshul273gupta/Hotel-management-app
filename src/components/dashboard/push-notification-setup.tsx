"use client";

import { useEffect } from "react";
import { registerPushToken } from "@/lib/firebase-client";

export function PushNotificationSetup() {
  useEffect(() => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      registerPushToken();
      return;
    }

    if (Notification.permission === "denied") return;

    // Prompt once per browser session, after a short delay
    if (sessionStorage.getItem("push-asked")) return;
    sessionStorage.setItem("push-asked", "1");

    const timer = setTimeout(async () => {
      const permission = await Notification.requestPermission();
      if (permission === "granted") registerPushToken();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}

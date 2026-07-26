"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtime } from "@/hooks/use-realtime";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@prisma/client";

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    // Soft bell "ding" — single clean tone with quick attack, gentle decay
    [880, 1108].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.5, t + i * 0.1 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.7);
    });
  } catch {}
}

const TYPE_ICON: Record<string, string> = {
  CHECK_IN: "🛎️",
  CHECK_OUT: "🧳",
  RESERVATION: "📅",
  SERVICE_REQUEST: "🔔",
  MAINTENANCE: "🛠️",
  PENDING_PAYMENT: "💳",
  WHATSAPP: "💬",
  HOUSEKEEPING: "🧹",
};

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useRealtime((kind, data) => {
    if (kind === "notification") {
      const notification = (data as { data?: Notification } | null)?.data;

      // A poll tick arrives with no payload — refetch instead, and only
      // announce entries we haven't already shown so the bell doesn't chime
      // repeatedly for the same notification.
      if (!notification) {
        fetch("/api/notifications")
          .then((res) => (res.ok ? res.json() : null))
          .then((fresh) => {
            if (!fresh) return;
            setNotifications((prev) => {
              const known = new Set(prev.map((n) => n.id));
              const added = (fresh.notifications as Notification[]).filter(
                (n) => !known.has(n.id),
              );
              if (added.length && prev.length) {
                playNotificationSound();
                const [first] = added;
                toast(first.title, {
                  description:
                    added.length > 1
                      ? `${first.message} (+${added.length - 1} more)`
                      : first.message,
                });
              }
              return fresh.notifications;
            });
            setUnreadCount(fresh.unreadCount);
          })
          .catch(() => {});
        return;
      }

      setNotifications((prev) =>
        prev.some((n) => n.id === notification.id)
          ? prev
          : [notification, ...prev].slice(0, 30),
      );
      setUnreadCount((prev) => prev + 1);
      playNotificationSound();
      toast(notification.title, { description: notification.message });
    } else if (
      kind === "rooms-updated" ||
      kind === "bookings-updated" ||
      kind === "requests-updated" ||
      kind === "dashboard-updated" ||
      kind === "guests-updated"
    ) {
      router.refresh();
    }
  });

  async function markAllRead() {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
  }

  async function onItemClick(notification: Notification) {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const content = (
                  <div
                    className={`flex gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 ${
                      !n.read ? "bg-primary/[0.04]" : ""
                    }`}
                  >
                    <span className="text-lg leading-none">{TYPE_ICON[n.type] ?? "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{n.title}</p>
                        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="line-clamp-2 text-muted-foreground">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => onItemClick(n)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    className="block w-full text-left"
                    onClick={() => onItemClick(n)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

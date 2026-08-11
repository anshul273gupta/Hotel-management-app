"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut, MonitorSmartphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRealtime } from "@/hooks/use-realtime";
import { timeAgo } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";

type Device = {
  id: string;
  device: string;
  ipAddress: string | null;
  signedInAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
  user: { id: string; name: string; username: string | null; role: string };
};

export function DevicesList() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      if (!res.ok) {
        setDevices([]);
        return;
      }
      const data = await res.json();
      setDevices(data.devices ?? []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Someone signing in or out elsewhere changes this list.
  useRealtime((kind) => {
    if (kind === "dashboard-updated") load();
  });

  async function signOut(device: Device) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${device.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not sign that device out");
        return;
      }
      toast.success(`${device.user.name}'s device has been signed out`);
      setSigningOut(null);
      load();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
      </div>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        No devices are signed in right now.
      </p>
    );
  }

  // Grouped by login so it's obvious at a glance how many devices each has.
  const groups = devices.reduce<Record<string, Device[]>>((acc, d) => {
    const key = `${d.user.role}:${d.user.id}`;
    (acc[key] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {devices.length} device{devices.length === 1 ? "" : "s"} signed in
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {Object.values(groups).map((group) => {
        const user = group[0].user;
        return (
          <div key={user.id + user.role} className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">
                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
              </p>
              <span className="text-xs text-muted-foreground">
                {user.username ? `ID: ${user.username}` : user.name} · {group.length} device
                {group.length === 1 ? "" : "s"}
              </span>
            </div>

            {group.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {d.device}
                        {d.isCurrent && (
                          <Badge variant="secondary" className="text-[10px]">
                            This device
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active {timeAgo(new Date(d.lastSeenAt))} · signed in{" "}
                        {timeAgo(new Date(d.signedInAt))}
                      </p>
                      {d.ipAddress && (
                        <p className="text-xs text-muted-foreground">IP {d.ipAddress}</p>
                      )}
                    </div>
                  </div>

                  {!d.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 text-rose-600 dark:text-rose-400"
                      onClick={() => setSigningOut(d)}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}

      <Dialog open={signingOut !== null} onOpenChange={(o) => !o && setSigningOut(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out this device?</DialogTitle>
            <DialogDescription>
              {signingOut && (
                <>
                  {signingOut.device} —{" "}
                  {ROLE_LABELS[signingOut.user.role as keyof typeof ROLE_LABELS] ??
                    signingOut.user.role}
                  . Whoever is using it will be returned to the login screen and will need the
                  password to get back in.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" className="w-full sm:w-auto">
                  Keep signed in
                </Button>
              }
            />
            <Button
              className="w-full gap-2 sm:w-auto"
              disabled={busy}
              onClick={() => signingOut && signOut(signingOut)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign out device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

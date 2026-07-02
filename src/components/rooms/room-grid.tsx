"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoomCard } from "@/components/rooms/room-card";
import { useRealtime } from "@/hooks/use-realtime";
import { ROOM_STATUS_LABELS, ROOM_STATUS_COLORS } from "@/lib/constants";
import type { RoomWithCurrentBooking } from "@/lib/rooms";
import type { RoomStatus } from "@/lib/types";

export function RoomGrid({ rooms }: { rooms: RoomWithCurrentBooking[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "ALL">("ALL");

  useRealtime((kind) => {
    if (kind === "rooms-updated" || kind === "bookings-updated") {
      router.refresh();
    }
  });

  const filtered = useMemo(() => {
    return rooms.filter((room) => {
      if (statusFilter !== "ALL" && room.status !== statusFilter) return false;
      return true;
    });
  }, [rooms, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RoomStatus | "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(ROOM_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(ROOM_STATUS_LABELS).map(([value, label]) => (
            <span key={value} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${ROOM_STATUS_COLORS[value as RoomStatus].dot}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
          No rooms match the selected filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}

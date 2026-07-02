import { EventEmitter } from "events";
import type { Notification } from "@prisma/client";

export type RealtimeEvent =
  | { kind: "notification"; data: Notification }
  | { kind: "rooms-updated" }
  | { kind: "bookings-updated" }
  | { kind: "requests-updated" }
  | { kind: "dashboard-updated" }
  | { kind: "guests-updated" };

const globalForEvents = globalThis as unknown as {
  hotelEventBus: EventEmitter | undefined;
};

export const eventBus =
  globalForEvents.hotelEventBus ??
  new EventEmitter({ captureRejections: true });

eventBus.setMaxListeners(0);

globalForEvents.hotelEventBus = eventBus;

const CHANNEL = "hotel-event";

export function emitRealtimeEvent(event: RealtimeEvent) {
  eventBus.emit(CHANNEL, event);
}

export function subscribeToRealtimeEvents(
  listener: (event: RealtimeEvent) => void,
) {
  eventBus.on(CHANNEL, listener);
  return () => {
    eventBus.off(CHANNEL, listener);
  };
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Loader2,
  RotateCcw,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { ID_PROOF_PATTERNS, ID_PROOF_TYPES, PAYMENT_METHOD_LABELS, normalizeIdProofNumber } from "@/lib/constants";
import { blockDigitKeys, blockNonDigitKeys } from "@/lib/input-guards";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { whatsappTemplates } from "@/lib/whatsapp";
import type { AvailableRoom } from "@/lib/rooms";

const MAX_ROOMS = 4;

const checkInSchema = z
  .object({
    title: z.enum(["Mr.", "Mrs.", "Ms.", "Dr.", "Master"]).default("Mr."),
    guestName: z
      .string()
      .min(1, "Guest name is required")
      .regex(/^[A-Za-z\s.'-]+$/, "Name should not contain numbers"),
    mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid Indian mobile number"),
    address: z.string().min(1, "Address is required"),
    idProofType: z.string().optional().default(""),
    idProofNumber: z.string().optional().default(""),
    numberOfGuests: z.coerce.number().int().min(1, "At least 1 guest").max(20),
    rooms: z
      .array(
        z.object({
          roomId: z.string().min(1),
          roomRate: z.coerce.number().positive("Enter the room rent"),
        }),
      )
      .min(1, "Select at least one room")
      .max(MAX_ROOMS, `You can select up to ${MAX_ROOMS} rooms`),
    expectedCheckOut: z.string().min(1, "Select an expected check-out date"),
    expectedCheckOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time"),
    advanceAmount: z.coerce.number().min(0).default(0),
    paymentMethod: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"]).default("CASH"),
    specialRequests: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.idProofType && data.idProofNumber) {
      const pattern = ID_PROOF_PATTERNS[data.idProofType as keyof typeof ID_PROOF_PATTERNS];
      if (pattern && !pattern.regex.test(normalizeIdProofNumber(data.idProofNumber))) {
        ctx.addIssue({ code: "custom", path: ["idProofNumber"], message: pattern.message });
      }
    }
    const checkOut = new Date(`${data.expectedCheckOut}T${data.expectedCheckOutTime}`);
    if (!Number.isNaN(checkOut.getTime()) && checkOut <= new Date()) {
      ctx.addIssue({ code: "custom", path: ["expectedCheckOut"], message: "Check-out must be in the future" });
    }
  });

type CheckInFormValues = z.input<typeof checkInSchema>;

type GuestLookup = {
  name: string;
  mobile: string;
  address: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  specialRequests: string | null;
  totalVisits: number;
  totalSpending: number;
  favoriteRoom: string | null;
};

type CheckInResult = {
  guest: { title: string; name: string; mobile: string };
  room: { number: string; floor: number };
  booking: { checkInDate: string; expectedCheckOut: string; totalAmount: number; amountPaid: number };
};

function toLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateString(d);
}

function defaultCheckOut() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateString(d);
}

/** Splits an amount across N parts (2 decimal places), giving any rounding remainder to the last part. */
function splitAmount(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (parts === 1) return [Math.round(total * 100) / 100];
  const base = Math.floor((total / parts) * 100) / 100;
  const shares = Array<number>(parts).fill(base);
  const distributed = Math.round(base * (parts - 1) * 100) / 100;
  shares[shares.length - 1] = Math.round((total - distributed) * 100) / 100;
  return shares;
}

export function CheckInForm({ rooms }: { rooms: AvailableRoom[] }) {
  const router = useRouter();
  const [returningGuest, setReturningGuest] = useState<GuestLookup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckInResult[] | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      title: "Mr." as const,
      numberOfGuests: 1,
      expectedCheckOut: defaultCheckOut(),
      expectedCheckOutTime: "10:00",
      rooms: [],
      advanceAmount: 0,
      paymentMethod: "CASH",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "rooms" });
  const watchedRooms = useWatch({ control, name: "rooms" }) ?? [];

  const idProofTypeValue = watch("idProofType");
  const idProofPattern = ID_PROOF_PATTERNS[idProofTypeValue as keyof typeof ID_PROOF_PATTERNS];

  const expectedCheckOutValue = watch("expectedCheckOut");
  const todayStr = new Date().toISOString().slice(0, 10);
  const nights =
    expectedCheckOutValue
      ? Math.max(1, Math.round((new Date(expectedCheckOutValue + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
  const totalEstimate =
    watchedRooms.reduce((sum, r) => sum + (Number(r?.roomRate) || 0), 0) * nights;

  function toggleRoom(room: AvailableRoom) {
    const index = fields.findIndex((f) => f.roomId === room.id);
    if (index !== -1) {
      remove(index);
      return;
    }
    if (fields.length >= MAX_ROOMS) {
      toast.error(`You can select up to ${MAX_ROOMS} rooms at once`);
      return;
    }
    append({ roomId: room.id, roomRate: Number(room.basePrice) });
  }

  async function lookupGuest(mobile: string) {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setReturningGuest(null);
      return;
    }
    try {
      const res = await fetch(`/api/guests/lookup?mobile=${mobile}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.guest) {
        setReturningGuest(data.guest);
        if (!watch("guestName")) setValue("guestName", data.guest.name);
        if (!watch("address") && data.guest.address) setValue("address", data.guest.address);
        if (!watch("idProofType") && data.guest.idProofType) {
          setValue("idProofType", data.guest.idProofType);
        }
        if (!watch("idProofNumber") && data.guest.idProofNumber) {
          setValue("idProofNumber", data.guest.idProofNumber);
        }
      } else {
        setReturningGuest(null);
      }
    } catch {
      // silent — lookup is a convenience, not critical
    }
  }

  async function onSubmit(values: CheckInFormValues) {
    setSubmitting(true);
    try {
      const totalAdvance = Number(values.advanceAmount) || 0;
      const shares = splitAmount(totalAdvance, values.rooms.length);
      const results: CheckInResult[] = [];

      for (let i = 0; i < values.rooms.length; i++) {
        const entry = values.rooms[i];
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (key === "rooms" || key === "advanceAmount" || key === "expectedCheckOutTime") return;
          if (value !== undefined && value !== null) formData.append(key, String(value));
        });
        formData.set("expectedCheckOut", `${values.expectedCheckOut}T${values.expectedCheckOutTime}`);
        formData.append("roomId", entry.roomId);
        formData.append("roomRate", String(entry.roomRate));
        formData.append("advanceAmount", String(shares[i]));

        const res = await fetch("/api/bookings", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            toast.error(
              typeof data.error === "string" ? data.error : "Your session has expired. Please log in again.",
            );
            router.push("/login");
            return;
          }
          const message = typeof data.error === "string" ? data.error : "Could not complete check-in";
          const roomLabel = rooms.find((r) => r.id === entry.roomId)?.number ?? "selected room";
          toast.error(`Room ${roomLabel}: ${message}`);
          if (results.length === 0) return;
          break;
        }

        results.push(data);
      }

      if (results.length === 0) return;

      setResult(results);
      const roomNumbers = results.map((r) => r.room.number).join(", ");
      toast.success(`${results[0].guest.name} checked into Room${results.length > 1 ? "s" : ""} ${roomNumbers}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startNewCheckIn() {
    setResult(null);
    setReturningGuest(null);
    reset({
      title: "Mr." as const,
      guestName: "",
      mobile: "",
      address: "",
      idProofType: "",
      idProofNumber: "",
      numberOfGuests: 1,
      rooms: [],
      expectedCheckOut: defaultCheckOut(),
      expectedCheckOutTime: "10:00",
      advanceAmount: 0,
      paymentMethod: "CASH",
      specialRequests: "",
    });
  }

  if (result) {
    const totalAmount = result.reduce((sum, r) => sum + r.booking.totalAmount, 0);
    const amountPaid = result.reduce((sum, r) => sum + r.booking.amountPaid, 0);
    const roomNumbers = result.map((r) => r.room.number).join(", ");
    const first = result[0];
    const greetingMsg = whatsappTemplates.checkInGreeting({
      title: first.guest.title ?? watch("title") ?? "Mr.",
      guestName: first.guest.name,
      checkInTime: formatDateTime(first.booking.checkInDate),
      roomNumber: roomNumbers,
    });

    return (
      <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="space-y-4 p-6">
          {/* Logo + header */}
          <div className="flex flex-col items-center gap-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="Hotel Logo" className="h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-emerald-300" />
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-display text-xl font-semibold">Check-in Complete!</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {first.guest.name} is checked into Room{result.length > 1 ? "s" : ""} {roomNumbers}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(first.booking.checkInDate)} → {formatDateTime(first.booking.expectedCheckOut)} ·{" "}
                {formatCurrency(amountPaid)} paid of {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          {/* Greeting message preview */}
          <div className="rounded-lg border bg-white/70 dark:bg-background/50 p-3 text-left">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">WhatsApp Greeting Preview</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(greetingMsg).then(() => toast.success("Copied!"))}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground font-sans">{greetingMsg}</pre>
          </div>

          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <WhatsAppButton
              mobile={first.guest.mobile}
              label="Send Check-in Greeting"
              message={greetingMsg}
            />
            <WhatsAppButton
              mobile={first.guest.mobile}
              label="Send Booking Confirmation"
              message={whatsappTemplates.bookingConfirmation({
                guestName: first.guest.name,
                roomNumber: roomNumbers,
                checkInDate: formatDate(first.booking.checkInDate),
                expectedCheckOut: formatDate(first.booking.expectedCheckOut),
                numberOfGuests: Number(watch("numberOfGuests")) || 1,
              })}
            />
          </div>

          <div className="flex justify-center">
            <Button onClick={startNewCheckIn} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Check in another guest
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {returningGuest && (
        <div className="flex items-start gap-2 rounded-lg border border-pink-200 bg-pink-50 p-3 text-sm dark:border-pink-900 dark:bg-pink-950/30">
          <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-pink-600 dark:text-pink-400" />
          <div>
            <p className="font-medium text-pink-800 dark:text-pink-300">Returning guest</p>
            <p className="text-xs text-pink-700 dark:text-pink-400">
              {returningGuest.totalVisits} previous visit{returningGuest.totalVisits === 1 ? "" : "s"} ·{" "}
              {formatCurrency(returningGuest.totalSpending)} total spend
              {returningGuest.favoriteRoom && ` · Usually books Room ${returningGuest.favoriteRoom}`}
            </p>
            {returningGuest.specialRequests && (
              <p className="mt-1 text-xs text-pink-700 dark:text-pink-400">
                Special requests: {returningGuest.specialRequests}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guest Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title *</Label>
                <Select value={watch("title")} onValueChange={(v) => setValue("title", v as CheckInFormValues["title"])}>
                  <SelectTrigger id="title" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Mr.", "Mrs.", "Ms.", "Dr.", "Master"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guestName">Guest Name *</Label>
                <Input id="guestName" placeholder="Full name" onKeyDown={blockDigitKeys} {...register("guestName")} />
                {errors.guestName && <p className="text-xs text-destructive">{errors.guestName.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mobile">Mobile Number *</Label>
              <div className="flex overflow-hidden rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                <span className="flex select-none items-center border-r bg-muted px-3 text-sm font-medium text-muted-foreground">
                  +91
                </span>
                <Input
                  id="mobile"
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  onKeyDown={blockNonDigitKeys}
                  className="rounded-none border-0 focus-visible:ring-0"
                  {...register("mobile", {
                    onBlur: (e) => lookupGuest(e.target.value.trim()),
                  })}
                />
              </div>
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" placeholder="Home / city address" {...register("address")} />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="idProofType">ID Proof Type</Label>
                <Select
                  value={watch("idProofType") || undefined}
                  onValueChange={(value) => setValue("idProofType", value ?? "")}
                >
                  <SelectTrigger className="w-full" id="idProofType">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {ID_PROOF_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.idProofType && <p className="text-xs text-destructive">{errors.idProofType.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="idProofNumber">{idProofPattern?.label ?? "ID Proof Number"}</Label>
                <Input
                  id="idProofNumber"
                  placeholder={idProofPattern?.placeholder ?? "Select ID type first"}
                  maxLength={idProofPattern?.maxLength ?? 20}
                  onKeyDown={idProofTypeValue === "Aadhaar Card" ? blockNonDigitKeys : undefined}
                  {...register("idProofNumber")}
                />
                {errors.idProofNumber && (
                  <p className="text-xs text-destructive">{errors.idProofNumber.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="specialRequests">Special Requests</Label>
              <Textarea id="specialRequests" placeholder="Optional notes" rows={2} {...register("specialRequests")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stay Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="numberOfGuests"># Guests *</Label>
                <Input id="numberOfGuests" type="number" min={1} max={20} {...register("numberOfGuests")} />
                {errors.numberOfGuests && (
                  <p className="text-xs text-destructive">{errors.numberOfGuests.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expectedCheckOut">Expected Check-out *</Label>
                <Input id="expectedCheckOut" type="date" min={tomorrowDateString()} {...register("expectedCheckOut")} />
                {errors.expectedCheckOut && (
                  <p className="text-xs text-destructive">{errors.expectedCheckOut.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expectedCheckOutTime">Check-out Time *</Label>
                <Input id="expectedCheckOutTime" type="time" {...register("expectedCheckOutTime")} />
                {errors.expectedCheckOutTime && (
                  <p className="text-xs text-destructive">{errors.expectedCheckOutTime.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Room Assignment * (select up to {MAX_ROOMS})</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rooms.map((room) => {
                  const selected = fields.some((f) => f.roomId === room.id);
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => toggleRoom(room)}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs transition-colors",
                        selected
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-input hover:bg-muted/50",
                      )}
                    >
                      <p className="font-medium">Room {room.number}</p>
                      <p className="text-muted-foreground">Floor {room.floor}</p>
                    </button>
                  );
                })}
              </div>
              {rooms.length === 0 && <p className="text-xs text-muted-foreground">No rooms available</p>}
              {errors.rooms?.message && <p className="text-xs text-destructive">{errors.rooms.message}</p>}
            </div>

            {fields.length > 0 && (
              <div className="space-y-1.5">
                <Label>Room Rent (per night) *</Label>
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const room = rooms.find((r) => r.id === field.roomId);
                    return (
                      <div key={field.id} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs font-medium">Room {room?.number ?? "—"}</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="flex-1"
                          {...register(`rooms.${index}.roomRate`)}
                        />
                      </div>
                    );
                  })}
                </div>
                {errors.rooms?.find?.((r) => r?.roomRate) && (
                  <p className="text-xs text-destructive">Enter a valid room rent for each room</p>
                )}
                {totalEstimate > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(totalEstimate)} estimated total ({nights} night{nights === 1 ? "" : "s"})
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="advanceAmount">Advance Payment</Label>
                <Input id="advanceAmount" type="number" min={0} step="0.01" {...register("advanceAmount")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select value={watch("paymentMethod")} onValueChange={(value) => setValue("paymentMethod", value as CheckInFormValues["paymentMethod"])}>
                  <SelectTrigger className="w-full" id="paymentMethod">
                    <SelectValue>
                      {(value: string) =>
                        PAYMENT_METHOD_LABELS[value as keyof typeof PAYMENT_METHOD_LABELS] ?? "Select"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {totalEstimate > 0 && (() => {
              const advance = Number(watch("advanceAmount")) || 0;
              const due = totalEstimate - advance;
              return (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Due Amount</span>
                  <span className={cn("text-sm font-bold", due > 0 ? "text-destructive" : "text-emerald-600")}>
                    {formatCurrency(Math.max(0, due))}
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <Button type="submit" size="lg" className="w-full gap-2 sm:w-auto" disabled={submitting || rooms.length === 0}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Complete Check-in
      </Button>
    </form>
  );
}

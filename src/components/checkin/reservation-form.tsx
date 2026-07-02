"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CalendarIcon,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import type { AvailableRoomForRange } from "@/lib/rooms";

const MAX_ROOMS = 4;

const reservationSchema = z
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
  });

type ReservationFormValues = z.input<typeof reservationSchema>;

type ReservationResult = {
  guest: { title: string; name: string; mobile: string };
  room: { number: string; floor: number };
  booking: { checkInDate: string; expectedCheckOut: string; totalAmount: number; amountPaid: number };
};

function toDateOnly(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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

export function ReservationForm({ initialRooms }: { initialRooms: AvailableRoomForRange[] }) {
  const router = useRouter();
  const [checkInDate, setCheckInDate] = useState<Date>(() => startOfToday());
  const [checkOutDate, setCheckOutDate] = useState<Date>(() => {
    const d = startOfToday();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [checkInTime, setCheckInTime] = useState("09:00");
  const [checkOutTime, setCheckOutTime] = useState("10:00");
  const [rooms, setRooms] = useState<AvailableRoomForRange[]>(initialRooms);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReservationResult[] | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    control,
    formState: { errors },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      title: "Mr." as const,
      numberOfGuests: 1,
      rooms: [],
      advanceAmount: 0,
      paymentMethod: "CASH",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "rooms" });
  const watchedRooms = useWatch({ control, name: "rooms" }) ?? [];

  const idProofTypeValue = watch("idProofType");
  const idProofPattern = ID_PROOF_PATTERNS[idProofTypeValue as keyof typeof ID_PROOF_PATTERNS];

  const nights = Math.max(
    1,
    Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const totalEstimate =
    watchedRooms.reduce((sum, r) => sum + (Number(r?.roomRate) || 0), 0) * nights;

  useEffect(() => {
    let cancelled = false;
    setLoadingRooms(true);
    fetch(`/api/rooms/availability?checkIn=${toDateOnly(checkInDate)}&checkOut=${toDateOnly(checkOutDate)}`)
      .then((res) => (res.ok ? res.json() : { rooms: [] }))
      .then((data) => {
        if (cancelled) return;
        const newRooms: AvailableRoomForRange[] = data.rooms ?? [];
        setRooms(newRooms);
        const currentRooms = getValues("rooms") ?? [];
        const filtered = currentRooms.filter((r) => newRooms.some((nr) => nr.id === r.roomId));
        if (filtered.length !== currentRooms.length) {
          replace(filtered);
        }
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRooms(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInDate, checkOutDate]);

  function toggleRoom(room: AvailableRoomForRange) {
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

  const isCheckInToday = checkInDate.toDateString() === new Date().toDateString();

  function onSelectCheckIn(date: Date | undefined) {
    if (!date) return;
    setCheckInDate(date);
    if (checkOutDate <= date) {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      setCheckOutDate(next);
    }
    if (date.toDateString() === new Date().toDateString()) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (checkInTime < currentTime) {
        setCheckInTime(currentTime);
      }
    }
  }

  function onSelectCheckOut(date: Date | undefined) {
    if (!date) return;
    setCheckOutDate(date);
  }

  function onChangeCheckInTime(time: string) {
    if (isCheckInToday) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (time < currentTime) {
        toast.error("Check-in time cannot be in the past");
        return;
      }
    }
    setCheckInTime(time);
  }

  async function onSubmit(values: ReservationFormValues) {
    const checkInDateTime = new Date(`${toDateOnly(checkInDate)}T${checkInTime}`);
    const checkOutDateTime = new Date(`${toDateOnly(checkOutDate)}T${checkOutTime}`);

    if (checkInDate.toDateString() === new Date().toDateString() && checkInDateTime < new Date()) {
      toast.error("Check-in time cannot be in the past");
      return;
    }
    if (checkOutDateTime <= checkInDateTime) {
      toast.error("Check-out date & time must be after check-in");
      return;
    }

    setSubmitting(true);
    try {
      const totalAdvance = Number(values.advanceAmount) || 0;
      const shares = splitAmount(totalAdvance, values.rooms.length);
      const results: ReservationResult[] = [];

      for (let i = 0; i < values.rooms.length; i++) {
        const entry = values.rooms[i];
        const res = await fetch("/api/bookings/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: values.title,
            guestName: values.guestName,
            mobile: values.mobile,
            address: values.address,
            idProofType: values.idProofType,
            idProofNumber: values.idProofNumber,
            numberOfGuests: values.numberOfGuests,
            specialRequests: values.specialRequests,
            paymentMethod: values.paymentMethod,
            roomId: entry.roomId,
            roomRate: entry.roomRate,
            advanceAmount: shares[i],
            checkInDate: `${toDateOnly(checkInDate)}T${checkInTime}`,
            expectedCheckOut: `${toDateOnly(checkOutDate)}T${checkOutTime}`,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            toast.error(
              typeof data.error === "string" ? data.error : "Your session has expired. Please log in again.",
            );
            router.push("/login");
            return;
          }
          const message = typeof data.error === "string" ? data.error : "Could not create the booking";
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
      toast.success(`Room${results.length > 1 ? "s" : ""} ${roomNumbers} booked for ${results[0].guest.name}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startNewBooking() {
    setResult(null);
    setCheckInTime("09:00");
    setCheckOutTime("10:00");
    reset({
      title: "Mr." as const,
      guestName: "",
      mobile: "",
      address: "",
      idProofType: "",
      idProofNumber: "",
      numberOfGuests: 1,
      rooms: [],
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

    return (
      <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="font-display text-xl font-semibold">Booking Confirmed!</h2>
            <p className="text-sm text-muted-foreground">
              Room{result.length > 1 ? "s" : ""} {roomNumbers} reserved for {first.guest.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(first.booking.checkInDate)} → {formatDateTime(first.booking.expectedCheckOut)} ·{" "}
              {formatCurrency(amountPaid)} paid of {formatCurrency(totalAmount)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
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

          <Button onClick={startNewBooking} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Create another booking
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guest Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="resGuestName">Guest Name *</Label>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <Select
                  value={watch("title")}
                  onValueChange={(v) => setValue("title", v as ReservationFormValues["title"])}
                >
                  <SelectTrigger id="resTitle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Mr.", "Mrs.", "Ms.", "Dr.", "Master"] as const).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input id="resGuestName" placeholder="Full name" onKeyDown={blockDigitKeys} {...register("guestName")} />
              </div>
              {errors.guestName && <p className="text-xs text-destructive">{errors.guestName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resMobile">Mobile Number *</Label>
              <div className="flex overflow-hidden rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                <span className="flex select-none items-center border-r bg-muted px-3 text-sm font-medium text-muted-foreground">
                  +91
                </span>
                <Input
                  id="resMobile"
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  onKeyDown={blockNonDigitKeys}
                  className="rounded-none border-0 focus-visible:ring-0"
                  {...register("mobile")}
                />
              </div>
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resAddress">Address *</Label>
              <Input id="resAddress" placeholder="Home / city address" {...register("address")} />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="resIdProofType">ID Proof Type</Label>
                <Select
                  value={watch("idProofType") || undefined}
                  onValueChange={(value) => setValue("idProofType", value ?? "")}
                >
                  <SelectTrigger className="w-full" id="resIdProofType">
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
                <Label htmlFor="resIdProofNumber">{idProofPattern?.label ?? "ID Proof Number"}</Label>
                <Input
                  id="resIdProofNumber"
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
              <Label htmlFor="resSpecialRequests">Special Requests</Label>
              <Textarea id="resSpecialRequests" placeholder="Optional notes" rows={2} {...register("specialRequests")} />
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
                <Label>Check-in Date *</Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="w-full justify-start gap-2 font-normal" type="button" />
                    }
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {format(checkInDate, "dd MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={checkInDate}
                      onSelect={onSelectCheckIn}
                      disabled={{ before: startOfToday() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resCheckInTime">Check-in Time *</Label>
                <Input
                  id="resCheckInTime"
                  type="time"
                  value={checkInTime}
                  onChange={(e) => onChangeCheckInTime(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Check-out Date *</Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="w-full justify-start gap-2 font-normal" type="button" />
                    }
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {format(checkOutDate, "dd MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={checkOutDate}
                      onSelect={onSelectCheckOut}
                      disabled={{ before: new Date(checkInDate.getTime() + 86400000) }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resCheckOutTime">Check-out Time *</Label>
                <Input
                  id="resCheckOutTime"
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {nights} night{nights === 1 ? "" : "s"}
            </p>

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
              {rooms.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {loadingRooms ? "Checking availability..." : "No rooms available for these dates"}
                </p>
              )}
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

            <div className="space-y-1.5">
              <Label htmlFor="resNumberOfGuests"># Guests *</Label>
              <Input id="resNumberOfGuests" type="number" min={1} max={20} {...register("numberOfGuests")} />
              {errors.numberOfGuests && (
                <p className="text-xs text-destructive">{errors.numberOfGuests.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="resAdvanceAmount">Advance Payment</Label>
                <Input id="resAdvanceAmount" type="number" min={0} step="0.01" {...register("advanceAmount")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resPaymentMethod">Payment Method</Label>
                <Select value={watch("paymentMethod")} onValueChange={(value) => setValue("paymentMethod", value as ReservationFormValues["paymentMethod"])}>
                  <SelectTrigger className="w-full" id="resPaymentMethod">
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
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        Create Booking
      </Button>
    </form>
  );
}

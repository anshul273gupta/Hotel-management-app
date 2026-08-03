"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRealtime } from "@/hooks/use-realtime";
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { GuestRegisterEntry } from "@/lib/guests";
import { GuestHistorySheet } from "@/components/guests/guest-history-sheet";
import type { BookingStatus } from "@/lib/types";

const STAY_STATUS_FILTERS = [
  { value: "ALL", label: "All Guests" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "RESERVED", label: "Upcoming / Reserved" },
  { value: "CHECKED_OUT", label: "Checked Out" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export function GuestsTable({ guests }: { guests: GuestRegisterEntry[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | BookingStatus>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? guests.find((g) => g.id === selectedId) ?? null : null;

  useRealtime((kind) => {
    if (kind === "guests-updated" || kind === "bookings-updated") {
      router.refresh();
    }
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return guests.filter((guest) => {
      if (query) {
        const haystack = `${guest.name} ${guest.mobile ?? ""} ${guest.address ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (fromDate && guest.lastCheckIn) {
        if (new Date(guest.lastCheckIn) < new Date(fromDate)) return false;
      }
      if (toDate && guest.lastCheckIn) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (new Date(guest.lastCheckIn) > to) return false;
      }
      if (statusFilter === "CANCELLED") {
        // currentStatus only reports the guest's latest booking, so a
        // cancellation followed by a later stay would never surface. Match
        // on any cancelled booking in their history instead.
        if (!guest.bookings.some((b) => b.status === "CANCELLED")) return false;
      } else if (statusFilter !== "ALL" && guest.currentStatus !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [guests, search, fromDate, toDate, statusFilter]);

  function exportCsv() {
    const rows = filtered.map((guest) => ({
      Name: guest.name,
      Mobile: guest.mobile ?? "",
      Address: guest.address ?? "",
      "ID Proof Type": guest.idProofType ?? "",
      "ID Proof Number": guest.idProofNumber ?? "",
      Status: guest.currentStatus ? BOOKING_STATUS_LABELS[guest.currentStatus] : "",
      "Last Check-in": guest.lastCheckIn ? formatDate(guest.lastCheckIn) : "",
      "Last Check-out": guest.lastCheckOut ? formatDate(guest.lastCheckOut) : "",
      "Total Visits": guest.totalVisits,
      "Total Spending": guest.totalSpending,
      "Favorite Room": guest.favoriteRoom ?? "",
      "Special Requests": guest.specialRequests ?? "",
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guest-register-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, or address"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | BookingStatus)}>
          <SelectTrigger className="w-auto min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAY_STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" className="w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <Button variant="outline" className="gap-1.5" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead className="hidden md:table-cell">Address</TableHead>
              <TableHead className="hidden lg:table-cell">ID Proof</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Stay</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Total Spend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No guests match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((guest) => (
                <TableRow
                  key={guest.id}
                  className={`cursor-pointer ${
                    guest.hasPendingPayment ? "bg-red-50 dark:bg-red-950/20" : ""
                  }`}
                  onClick={() => setSelectedId(guest.id)}
                >
                  <TableCell className="font-medium">{guest.name}</TableCell>
                  <TableCell>{guest.mobile ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden max-w-48 truncate md:table-cell">
                    {guest.address ?? "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-48 truncate lg:table-cell">
                    {guest.idProofType
                      ? `${guest.idProofType}${guest.idProofNumber ? ` (${guest.idProofNumber})` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {guest.currentStatus ? (
                        <Badge className={`${BOOKING_STATUS_COLORS[guest.currentStatus]} border-0`}>
                          {BOOKING_STATUS_LABELS[guest.currentStatus]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                      {guest.hasPendingPayment && (
                        <Badge className={`${PAYMENT_STATUS_COLORS.PENDING} border-0`}>
                          Payment Due
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {guest.lastCheckIn ? (
                      <span className="text-xs">
                        {formatDate(guest.lastCheckIn)} → {formatDate(guest.lastCheckOut!)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{guest.totalVisits}</TableCell>
                  <TableCell className="text-right">{formatCurrency(guest.totalSpending)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GuestHistorySheet guest={selected} open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  );
}

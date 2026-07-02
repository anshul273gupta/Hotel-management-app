import Link from "next/link";
import {
  BedDouble,
  DoorOpen,
  LogIn,
  LogOut,
  Users,
  Wallet,
  CreditCard,
} from "lucide-react";
import { getDashboardSummary, getDashboardDetails } from "@/lib/dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime, toDecimalNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, details] = await Promise.all([getDashboardSummary(), getDashboardDetails()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(new Date())} · Overview of today&apos;s operations
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Rooms Occupied Today"
          value={summary.roomsOccupied}
          icon={BedDouble}
          accent="danger"
        />
        <KpiCard
          label="Rooms Vacant Today"
          value={summary.roomsVacant}
          icon={DoorOpen}
          accent="success"
        />
        <KpiCard
          label="Today's Check-ins"
          value={summary.checkInsToday}
          icon={LogIn}
          accent="info"
        />
        <KpiCard
          label="Today's Check-outs"
          value={summary.checkOutsToday}
          icon={LogOut}
          accent="violet"
        />
        <KpiCard
          label="Total Guests Staying"
          value={summary.totalGuestsStaying}
          icon={Users}
          accent="default"
        />
        <KpiCard
          label="Revenue Today"
          value={formatCurrency(summary.revenueToday)}
          icon={Wallet}
          accent="success"
        />
        <KpiCard
          label="Pending Payments"
          value={formatCurrency(summary.pendingPaymentsTotal)}
          hint={`${summary.pendingPaymentsCount} booking${summary.pendingPaymentsCount === 1 ? "" : "s"}`}
          icon={CreditCard}
          accent="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {details.todaysCheckIns.length === 0 ? (
              <EmptyRow text="No check-ins scheduled for today." />
            ) : (
              details.todaysCheckIns.map((b) => (
                <Link
                  key={b.id}
                  href="/guests"
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{b.guest.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Room {b.room.number} · {b.numberOfGuests} guest
                      {b.numberOfGuests === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(b.checkInDate)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Check-outs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {details.todaysCheckOuts.length === 0 ? (
              <EmptyRow text="No check-outs scheduled for today." />
            ) : (
              details.todaysCheckOuts.map((b) => (
                <Link
                  key={b.id}
                  href="/guests"
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{b.guest.name}</p>
                    <p className="text-xs text-muted-foreground">Room {b.room.number}</p>
                  </div>
                  <Badge variant={b.actualCheckOut ? "secondary" : "outline"}>
                    {b.actualCheckOut ? "Checked out" : "Pending"}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {details.pendingPayments.length === 0 ? (
              <EmptyRow text="No pending payments." />
            ) : (
              details.pendingPayments.map((b) => (
                <Link
                  key={b.id}
                  href="/guests"
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{b.guest.name}</p>
                    <p className="text-xs text-muted-foreground">Room {b.room.number}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {formatCurrency(toDecimalNumber(b.totalAmount) - toDecimalNumber(b.amountPaid))}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{text}</p>;
}

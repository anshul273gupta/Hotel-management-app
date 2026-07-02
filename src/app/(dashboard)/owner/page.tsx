import { redirect } from "next/navigation";
import { Wallet, PiggyBank } from "lucide-react";
import { getProfitSummary, getProfitTrend } from "@/lib/profit";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProfitTrendChart } from "@/components/owner/profit-trend-chart";
import { formatCurrency, formatDate } from "@/lib/format";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "OWNER") redirect("/");
  const [summary, trend] = await Promise.all([
    getProfitSummary(),
    getProfitTrend(14),
  ]);

  const periods: { key: keyof typeof summary; title: string }[] = [
    { key: "today", title: "Today" },
    { key: "week", title: "This Week" },
    { key: "month", title: "This Month" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Profit Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(new Date())} · Revenue &amp; profit overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {periods.map((period) => {
          const data = summary[period.key];
          return (
            <div key={period.key} className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">{period.title}</h2>
              <div className="grid grid-cols-1 gap-3">
                <KpiCard label="Revenue" value={formatCurrency(data.revenue)} icon={Wallet} accent="success" />
                <KpiCard
                  label="Profit"
                  value={formatCurrency(data.profit)}
                  icon={PiggyBank}
                  accent={data.profit >= 0 ? "info" : "danger"}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ProfitTrendChart data={trend} />
    </div>
  );
}

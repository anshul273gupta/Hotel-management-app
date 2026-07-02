"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

type TrendPoint = { date: string; revenue: number; expenses: number; profit: number }; // expenses kept in type for API compat

export function ProfitTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profit Trend (Last {data.length} Days)</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-3)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => `₹${value / 1000}k`} width={50} />
            <Tooltip
              formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
              labelFormatter={(label) => new Date(String(label)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            />
            <Legend />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-chart-1)" fill="url(#revenueFill)" strokeWidth={2} />
            <Area type="monotone" dataKey="profit" name="Profit" stroke="var(--color-chart-3)" fill="url(#profitFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

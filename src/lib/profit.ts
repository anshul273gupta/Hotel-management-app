import { prisma } from "@/lib/prisma";
import { toDecimalNumber } from "@/lib/format";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function rangeTotals(start: Date, end: Date) {
  const [revenue, expenses] = await Promise.all([
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lt: end }, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const revenueTotal = toDecimalNumber(revenue._sum.amount);
  const expensesTotal = toDecimalNumber(expenses._sum.amount);

  return { revenue: revenueTotal, expenses: expensesTotal, profit: revenueTotal - expensesTotal };
}

export async function getProfitSummary() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const weekStart = new Date(todayStart);
  // Monday-start week: Mon=0 offset, Tue=1, ..., Sun=6
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, week, month] = await Promise.all([
    rangeTotals(todayStart, todayEnd),
    rangeTotals(weekStart, todayEnd),
    rangeTotals(monthStart, todayEnd),
  ]);

  return { today, week, month };
}

export type ProfitSummary = Awaited<ReturnType<typeof getProfitSummary>>;

export async function getProfitTrend(days = 14) {
  const end = startOfDay(new Date());
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: end }, status: "PAID" },
      select: { amount: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lt: end } },
      select: { amount: true, date: true },
    }),
  ]);

  const buckets = new Map<string, { revenue: number; expenses: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`, { revenue: 0, expenses: 0 });
  }

  for (const payment of payments) {
    const key = `${payment.paidAt.getFullYear()}-${String(payment.paidAt.getMonth()+1).padStart(2,"0")}-${String(payment.paidAt.getDate()).padStart(2,"0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.revenue += toDecimalNumber(payment.amount);
  }
  for (const expense of expenses) {
    const key = `${expense.date.getFullYear()}-${String(expense.date.getMonth()+1).padStart(2,"0")}-${String(expense.date.getDate()).padStart(2,"0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.expenses += toDecimalNumber(expense.amount);
  }

  return [...buckets.entries()].map(([date, totals]) => ({
    date,
    revenue: totals.revenue,
    expenses: totals.expenses,
    profit: totals.revenue - totals.expenses,
  }));
}

export async function getRecentExpenses(limit = 15) {
  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { createdBy: { select: { name: true } } },
  });

  return expenses.map((expense) => ({
    id: expense.id,
    category: expense.category,
    description: expense.description,
    amount: toDecimalNumber(expense.amount),
    date: expense.date,
    createdBy: expense.createdBy.name,
  }));
}

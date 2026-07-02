import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getRecentExpenses } from "@/lib/profit";
import { broadcastUpdate } from "@/lib/notifications";

const schema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const expenses = await getRecentExpenses();
  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      category: parsed.data.category,
      description: parsed.data.description || undefined,
      amount: parsed.data.amount,
      date: new Date(parsed.data.date),
      createdById: session.userId,
    },
  });

  broadcastUpdate("dashboard-updated");

  return NextResponse.json({ expense });
}

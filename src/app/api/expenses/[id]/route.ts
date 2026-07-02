import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { broadcastUpdate } from "@/lib/notifications";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.expense.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  broadcastUpdate("dashboard-updated");

  return NextResponse.json({ ok: true });
}

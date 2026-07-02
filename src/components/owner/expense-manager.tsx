"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

const expenseSchema = z.object({
  category: z.string().min(1, "Select a category"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().min(1),
});

type ExpenseFormValues = z.input<typeof expenseSchema>;

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  date: string | Date;
  createdBy: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseManager({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: "", description: "", amount: 0, date: today() },
  });

  async function onSubmit(values: ExpenseFormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast.error("Could not add expense");
        return;
      }
      toast.success("Expense added");
      reset({ category: "", description: "", amount: 0, date: today() });
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExpense(id: string) {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete expense");
      return;
    }
    toast.success("Expense removed");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Expenses</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="h-4 w-4" />
            Add Expense
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Select value={watch("category") || undefined} onValueChange={(value) => setValue("category", value ?? "")}>
                  <SelectTrigger className="w-full" id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input id="amount" type="number" min={0} step="0.01" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" {...register("date")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={2} placeholder="Optional notes" {...register("description")} />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving..." : "Save Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No expenses recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-xs">{formatDate(expense.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{expense.category}</TableCell>
                    <TableCell className="hidden max-w-56 truncate text-sm text-muted-foreground sm:table-cell">
                      {expense.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => deleteExpense(expense.id)} aria-label="Delete expense">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

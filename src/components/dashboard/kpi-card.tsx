import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: "default" | "success" | "warning" | "danger" | "info" | "violet";
}) {
  const accentClasses: Record<string, string> = {
    default: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white",
    success: "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950",
    warning: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
    danger: "bg-rose-500 text-white dark:bg-rose-400 dark:text-rose-950",
    info: "bg-teal-500 text-white dark:bg-teal-400 dark:text-teal-950",
    violet: "bg-fuchsia-500 text-white dark:bg-fuchsia-400 dark:text-fuchsia-950",
  };

  const borderClasses: Record<string, string> = {
    default: "border-l-emerald-600",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-rose-500",
    info: "border-l-teal-500",
    violet: "border-l-fuchsia-500",
  };

  return (
    <Card className={cn("border-l-4", borderClasses[accent])}>
      <CardContent className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm", accentClasses[accent])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
}

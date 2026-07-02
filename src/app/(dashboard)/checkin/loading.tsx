import { Skeleton } from "@/components/ui/skeleton";

export default function CheckinLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-8 w-64 rounded-lg" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[28rem] rounded-xl" />
        <Skeleton className="h-[28rem] rounded-xl" />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, Clock, BedDouble } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SERVICE_REQUEST_TYPE_LABELS,
  SERVICE_REQUEST_TYPE_ICONS,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_STATUS_COLORS,
} from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { ServiceRequestWithRelations } from "@/lib/requests";
import type { ServiceRequestStatus } from "@/lib/types";

export function RequestCard({ request }: { request: ServiceRequestWithRelations }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function patch(payload: { status?: ServiceRequestStatus }) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/service-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch {
      toast.error("Could not update request");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {SERVICE_REQUEST_TYPE_ICONS[request.type]} {SERVICE_REQUEST_TYPE_LABELS[request.type]}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <BedDouble className="h-3 w-3" /> Room {request.room.number} · Floor {request.room.floor}
            </p>
          </div>
          <Badge className={`${SERVICE_REQUEST_STATUS_COLORS[request.status]} border-0`}>
            {SERVICE_REQUEST_STATUS_LABELS[request.status]}
          </Badge>
        </div>

        {request.description && (
          <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">{request.description}</p>
        )}

        {request.photoUrl && (
          <a href={request.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img src={request.photoUrl} alt="Request attachment" className="h-24 w-full rounded-md object-cover" />
          </a>
        )}

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {timeAgo(request.createdAt)}
        </p>

        {request.rating !== null && (
          <div className="flex items-center gap-2 border-t pt-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${star <= request.rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                />
              ))}
            </div>
            {request.ratingComment && <p className="text-xs text-muted-foreground">&ldquo;{request.ratingComment}&rdquo;</p>}
          </div>
        )}

        <div className="border-t pt-2.5">
          {request.status === "COMPLETED" ? (
            <p className="text-center text-xs text-muted-foreground">Request completed — no further changes allowed</p>
          ) : (
            <Select value={request.status} onValueChange={(value) => value && patch({ status: value as ServiceRequestStatus })} disabled={updating}>
              <SelectTrigger className="w-full text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SERVICE_REQUEST_STATUS_LABELS)
                  .filter(([value]) => value !== "ASSIGNED" && value !== "COMPLETED")
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                <SelectItem value="COMPLETED">Mark as Completed</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

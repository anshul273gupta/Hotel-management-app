import { getServiceRequests } from "@/lib/requests";
import { RequestBoard } from "@/components/requests/request-board";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const requests = await getServiceRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Service Requests
        </h1>
        <p className="text-sm text-muted-foreground">
          Track and assign guest requests submitted via room QR codes.
        </p>
      </div>
      <RequestBoard requests={requests} />
    </div>
  );
}

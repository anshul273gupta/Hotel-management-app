"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shows a guest's ID photos with full-screen view and download.
 *
 * Both actions are handled in-page rather than by the browser. Inside the
 * Android WebView that wraps this app, `target="_blank"` opens nothing and the
 * `download` attribute is ignored — so on a phone the buttons appeared dead
 * while working fine on desktop. Fetching the image as a blob and driving the
 * overlay ourselves behaves identically everywhere.
 */
export function IdProofGallery({
  guestId,
  guestName,
  count,
}: {
  guestId: string;
  guestName: string;
  count: number;
}) {
  const [fullscreen, setFullscreen] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const src = (i: number) => `/api/guests/${guestId}/id-proof?i=${i}`;

  async function download(i: number) {
    setSaving(i);
    try {
      const res = await fetch(`${src(i)}&download=1`);
      if (!res.ok) throw new Error("Could not fetch the image");

      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
      const safe = guestName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
      const filename = `id-proof-${safe}${count > 1 ? `-${i + 1}` : ""}.${ext}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the WebView a moment to start writing before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      toast.success("Saved to your downloads");
    } catch {
      toast.error("Could not download — try again");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        ID Proof Photo{count > 1 ? `s (${count})` : ""}
      </p>

      <div className={count > 1 ? "grid grid-cols-2 gap-2" : ""}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <button
              type="button"
              onClick={() => setFullscreen(i)}
              className="relative block w-full overflow-hidden rounded-md border active:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src(i)}
                alt={`ID proof ${i + 1} for ${guestName}`}
                className="h-32 w-full object-cover"
              />
              <span className="absolute bottom-1 right-1 rounded bg-black/60 p-1">
                <Maximize2 className="h-3 w-3 text-white" />
              </span>
            </button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={saving === i}
              onClick={() => download(i)}
            >
              <Download className="h-3.5 w-3.5" />
              {saving === i ? "Saving…" : "Download"}
            </Button>
          </div>
        ))}
      </div>

      {fullscreen !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setFullscreen(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src(fullscreen)}
            alt={`ID proof ${fullscreen + 1} for ${guestName}`}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-6 gap-1.5"
            disabled={saving === fullscreen}
            onClick={(e) => {
              e.stopPropagation();
              download(fullscreen);
            }}
          >
            <Download className="h-4 w-4" />
            {saving === fullscreen ? "Saving…" : "Download"}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Globe, Save, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function QrUrlSettings({ currentUrl }: { currentUrl: string }) {
  const [url, setUrl] = useState(currentUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/qr-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.replace(/\/$/, "") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
      } else {
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          window.location.reload();
        }, 1500);
      }
    } catch {
      setError("Network error — please try again");
    }
    setSaving(false);
  }

  const isLocalUrl =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    /http:\/\/192\.168\.\d+\.\d+/.test(url) ||
    /http:\/\/10\.\d+\.\d+\.\d+/.test(url);

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-medium text-sm">QR Code Base URL</p>
            <p className="text-xs text-muted-foreground">
              Every QR code points to this address. Use a public URL so guests on any network can scan it.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            placeholder="https://your-domain.ngrok-free.app"
            className="font-mono text-sm"
          />
          <Button onClick={save} disabled={saving || saved} className="gap-2 shrink-0">
            {saved ? (
              <><CheckCircle className="h-4 w-4" /> Saved!</>
            ) : (
              <><Save className="h-4 w-4" /> Save</>
            )}
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {isLocalUrl && !saved && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Same WiFi only:</strong> This URL works only when the guest&apos;s phone is on the same network as this computer. For guests on mobile data or other WiFi, set up a free public tunnel below.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          How to get a free public URL (ngrok) so QR works on any network
        </button>

        {showGuide && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-xs space-y-2">
            <ol className="list-decimal ml-4 space-y-1.5 text-muted-foreground">
              <li>Go to <span className="font-mono text-foreground">ngrok.com</span> and create a free account.</li>
              <li>
                Download ngrok, then open a new terminal and run:
                <code className="ml-1 font-mono text-foreground bg-muted px-1 py-0.5 rounded">ngrok http 3000</code>
              </li>
              <li>Ngrok will show a public URL like <span className="font-mono text-foreground">https://abc123.ngrok-free.app</span>.</li>
              <li>Paste that URL in the field above and click <strong>Save</strong>.</li>
              <li>The QR codes will immediately update — guests can now scan from anywhere.</li>
            </ol>
            <p className="text-muted-foreground mt-2">
              <strong>Permanent URL:</strong> On ngrok&apos;s free plan you can claim one static domain so the URL never changes. Set it in <span className="font-mono">NGROK_STATIC_DOMAIN</span> in your <span className="font-mono">.env</span> file and restart via <span className="font-mono">node start-hotel.js</span>.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Image from "next/image";
import { Printer, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RoomQr = {
  id: string;
  number: string;
  floor: number;
  url: string;
  qrDataUrl: string;
};

function downloadQr(room: RoomQr) {
  const link = document.createElement("a");
  link.href = room.qrDataUrl;
  link.download = `room-${room.number}-qr.png`;
  link.click();
}

export function QrCodeGrid({ rooms }: { rooms: RoomQr[] }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print All
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-6">
        {rooms.map((room) => (
          <Card key={room.id} className="print:break-inside-avoid print:border print:shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="rounded-lg border bg-white p-2">
                <Image src={room.qrDataUrl} alt={`QR code for room ${room.number}`} width={180} height={180} unoptimized />
              </div>
              <div>
                <p className="text-lg font-semibold">Room {room.number}</p>
                <p className="text-xs text-muted-foreground">Floor {room.floor}</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadQr(room)}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  render={<a href={room.url} target="_blank" rel="noopener noreferrer" />}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

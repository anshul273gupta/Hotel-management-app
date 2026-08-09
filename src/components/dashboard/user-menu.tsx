"use client";

import { useState } from "react";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@/lib/types";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        // Without this the WebView may answer from its own cache and never
        // actually reach the server, leaving the session alive.
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch {
      // Offline or the request failed — still send them to the login page
      // below. The redirect there cannot succeed while a valid session
      // exists, so a failed sign-out can never look like a successful one.
    }

    // A full page load, not a client-side route change. Next.js keeps a
    // client-side cache of already-rendered pages, so router.push alone could
    // show the dashboard again from memory even though the cookie was gone.
    // Replacing the history entry also stops Back returning to the dashboard.
    window.location.replace("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="flex items-center gap-2 px-2" />}>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {getInitials(ROLE_LABELS[role])}
          </AvatarFallback>
        </Avatar>
        <div className="hidden flex-col items-start text-left sm:flex">
          <span className="text-sm font-medium leading-none">{ROLE_LABELS[role]}</span>
          <span className="text-xs text-muted-foreground leading-none mt-0.5">{email}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <User className="h-3.5 w-3.5" /> {ROLE_LABELS[role]}
              </span>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-rose-600 dark:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SPLASH_ELEMENT_ID, SPLASH_SEEN_KEY } from "@/lib/splash";

/**
 * The 8-second Agrawal Inn intro animation.
 *
 * Shown when the app is opened. It deliberately does NOT replay on every page
 * change — `sessionStorage` keeps it to once per app launch, and the Android
 * wrapper begins a fresh session each time the app is genuinely opened.
 *
 * The overlay is part of the very first HTML rather than something added after
 * JavaScript loads, so the dashboard never flashes into view behind it. A tiny
 * script in <head> (see layout.tsx) hides it before the first paint when the
 * intro has already been seen this session.
 *
 * Anyone in a hurry can tap to skip, and it fails safe: if the video cannot
 * play at all (autoplay refused, file missing, slow connection) the overlay
 * closes itself instead of trapping the user behind a blank screen.
 */

/** Hard ceiling — the overlay always leaves, whatever the video does. */
const FAILSAFE_MS = 9500;
const FADE_MS = 450;

export function SplashScreen() {
  const pathname = usePathname();

  // Guests scanning the room QR code are not staff opening the app — they
  // should land straight on the service page, not sit through a hotel intro.
  const isGuestPage = pathname?.startsWith("/guest") ?? false;

  // Rendered on the server too, so it is on screen from the first paint.
  // The head script has already hidden it via CSS if it was seen this session.
  const [visible, setVisible] = useState(!isGuestPage);
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback(() => {
    setLeaving(true);
    timers.current.push(window.setTimeout(() => setVisible(false), FADE_MS));
  }, []);

  useEffect(() => {
    if (isGuestPage) {
      setVisible(false);
      return;
    }

    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
    } catch {
      // Private mode or storage disabled — treat as unseen. The failsafe below
      // still guarantees the overlay goes away.
    }

    if (alreadySeen) {
      // Already hidden by the head script; just drop it from the tree.
      setVisible(false);
      return;
    }

    try {
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    } catch {}

    timers.current.push(window.setTimeout(dismiss, FAILSAFE_MS));

    // Some Android WebViews will not autoplay until asked directly, even when
    // muted. Nudge it, and if it still refuses, move on rather than hang.
    const video = videoRef.current;
    const attempt = video?.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => dismiss());
    }
  }, [isGuestPage, dismiss]);

  // Stop the page behind from scrolling while the splash covers it.
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  if (!visible) return null;

  return (
    <div
      id={SPLASH_ELEMENT_ID}
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
      onClick={dismiss}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
          dismiss();
        }
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#b3aca7]"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <video
        ref={videoRef}
        // object-cover fills any phone shape without letterboxing; the logo is
        // centred in the source, so it stays centred when cropped.
        className="h-full w-full object-cover"
        poster="/splash-poster.jpg"
        autoPlay
        muted
        playsInline
        // Explicitly NOT looping — it plays once, then hands over to the app.
        onEnded={dismiss}
        onError={dismiss}
        preload="auto"
      >
        <source src="/splash.webm" type="video/webm" />
        <source src="/splash.mp4" type="video/mp4" />
      </video>

      <span className="pointer-events-none absolute bottom-8 text-xs font-medium tracking-wide text-black/45">
        Tap to skip
      </span>
    </div>
  );
}

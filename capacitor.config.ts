import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android wrapper loads the deployed site rather than bundling a copy of
 * it, so staff always get the current version without reinstalling the APK.
 *
 * Set CAP_SERVER_URL when building against something else (a LAN address or a
 * tunnel while developing). Previously this file auto-detected a tunnel URL
 * from .tunnel-url or guessed a Wi-Fi IP — both went stale the moment the
 * laptop moved network, leaving the installed app pointing at nothing.
 */
const PRODUCTION_URL = 'https://hotel-management-app-smoky-delta.vercel.app';

const serverUrl = process.env.CAP_SERVER_URL?.trim() || PRODUCTION_URL;

const config: CapacitorConfig = {
  appId: 'com.AgrawalInn.hotelmanagement',
  appName: 'Hotel Agrawal Inn',
  // Only used if server.url is removed and the app runs fully offline.
  webDir: 'public',
  server: {
    url: serverUrl,
    // Plain http is only tolerated for local development builds.
    cleartext: !serverUrl.startsWith('https'),
  },
  android: {
    backgroundColor: '#b3aca7',
  },
  plugins: {
    /**
     * Android 15+ always draws apps edge-to-edge, so the web page starts at the
     * very top of the screen — behind the clock and battery icons. "css" makes
     * Capacitor inject the real --safe-area-inset-* values into the page, which
     * globals.css uses to push the header down and the tab bar up.
     */
    SystemBars: {
      insetsHandling: 'css',
      // DEFAULT = follow the device theme, so the clock is dark on our light
      // header in light mode and light-on-dark when the app is in dark mode.
      style: 'DEFAULT',
    },
  },
};

export default config;

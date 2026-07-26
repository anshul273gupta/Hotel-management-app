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
    backgroundColor: '#052e16',
  },
};

export default config;

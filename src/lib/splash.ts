/**
 * Shared constants for the opening animation.
 *
 * These live in their own module, with no "use client" directive, so both the
 * server layout and the client component can import them. Importing a value
 * from a "use client" file into a server component does not give you the
 * value — Next.js replaces it with a client reference stub, which is how the
 * inline splash script silently ended up with a broken key.
 */

export const SPLASH_ELEMENT_ID = "app-splash";
export const SPLASH_SEEN_KEY = "agrawal-splash-seen";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/splash-screen";
import { SPLASH_SEEN_KEY } from "@/lib/splash";

/*
 * Only the body font is preloaded. The other two are used for a handful of
 * headings and code-style text, and preloading all three made the phone wait
 * on three font downloads before the first paint.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  // Headings only need the semibold cut we actually apply.
  weight: ["600"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Hotel Agrawal Inn — Management Suite",
  description: "Premium hotel management & room inventory system",
  // Lets Android and iOS install the site as a standalone app.
  manifest: "/manifest.json",
  applicationName: "Agrawal Inn",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Agrawal Inn",
    // Dark status bar text over the app's deep green header.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#052e16",
  // Full-bleed on notched phones, and stop iOS zooming when a field is focused.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Runs before the first paint. The intro is in the server-rendered HTML
          so the app never flashes into view behind it — but that means it would
          also appear on every page change. This hides it instantly (no flicker)
          whenever it has already played during this app session, and on the
          guest QR pages.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var seen=sessionStorage.getItem('${SPLASH_SEEN_KEY}')==='1';var guest=location.pathname.indexOf('/guest')===0;if(seen||guest){document.documentElement.classList.add('splash-done');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SplashScreen />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

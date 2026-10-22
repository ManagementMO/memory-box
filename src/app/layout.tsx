import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./living-mosaic.css";
import "./poppy-canvas.css";
import "./toybox.css";
import "./meet-here.css";

const schibsted = localFont({ src: "../../public/fonts/schibsted-grotesk-latin.woff2", variable: "--font-schibsted", weight: "400 700", display: "swap", fallback: ["Arial", "sans-serif"] });
const pixelify = localFont({ src: "../../public/fonts/pixelify-sans-latin.woff2", variable: "--font-pixelify", weight: "400 700", display: "swap", adjustFontFallback: false, fallback: ["sans-serif"] });
const plexMono = localFont({ src: "../../public/fonts/ibm-plex-mono-latin.woff2", variable: "--font-plex-mono", weight: "400", display: "swap", preload: false, adjustFontFallback: false, fallback: ["monospace"] });
const caveat = localFont({ src: "../../public/fonts/caveat-medium.ttf", variable: "--font-caveat", weight: "500", display: "swap", preload: false, adjustFontFallback: false, fallback: ["cursive"] });

export const metadata: Metadata = {
  title: "Memory Box — Waterloo commons",
  description: "An unofficial Waterloo commons. Paint a campus goose, leave a memory or a ridiculous idea, and build on what other people leave.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFFFFF", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${schibsted.variable} ${pixelify.variable} ${plexMono.variable} ${caveat.variable}`}><body>{children}</body></html>;
}

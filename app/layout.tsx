import "./globals.css";
import type { Metadata } from "next";
import NavBar from "@/components/NavBar";

/**
 * Global metadata (favicon, iOS icon, PWA)
 */
export const metadata: Metadata = {
  title: "PostNord Cup",
  description: "PostNord Cup – Trackman @ Troxhammar GK",
  manifest: "/manifest.json",
  themeColor: "#0b1220",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <head>
        {/* iOS Home Screen icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Fallbacks (bra för äldre browsers) */}
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0b1220" />
      </head>

      <body className="min-h-screen bg-[#070b14] text-white antialiased">
        {/* Top navigation */}
        <NavBar />

        {/* Page content */}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
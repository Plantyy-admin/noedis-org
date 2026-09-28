import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOEDIS APEX — hlasové řízení firmy",
  description:
    "APEX orb — hlasové rozhraní k NOEDIS Autonomous Company. Mluvíš, orb slyší, firma pracuje.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050b18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

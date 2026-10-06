import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/layout/theme";
import { ToastProvider } from "@/components/ui/Toast";
import { GeoProvider } from "@/lib/client/geo";
// Poppins paketin içindədir (@fontsource) — build zamanı Google Fonts-a çıxış lazım deyil,
// latin-ext alt dəsti Azərbaycan hərflərini (ə, ğ, ı, ö, ş, ü, ç) əhatə edir.
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "YolXəbər", template: "%s · YolXəbər" },
  description: "Yol nişanları, sürət limitləri və kameralardakı dəyişikliklər — sürücülərdən sürücülərə.",
  applicationName: "YolXəbər",
  appleWebApp: { capable: true, title: "YolXəbər", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0A111E" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans">
        <GeoProvider>
          <ToastProvider>{children}</ToastProvider>
        </GeoProvider>
      </body>
    </html>
  );
}

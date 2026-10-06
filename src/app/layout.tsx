import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ThemeScript } from "@/components/layout/theme";
import { ToastProvider } from "@/components/ui/Toast";
import { GeoProvider } from "@/lib/client/geo";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

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
      <body className={`${poppins.variable} font-sans`}>
        <GeoProvider>
          <ToastProvider>{children}</ToastProvider>
        </GeoProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import Script from 'next/script'
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "./components/Navigation";
import ClaimRewardPrompt from "./components/ClaimRewardPrompt";
import TelegramAnalytics from "./components/TelegramAnalytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "r7",
  description: "Opinion market",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsToken = process.env.NEXT_PUBLIC_TG_ANALYTICS_TOKEN
  const analyticsAppName = process.env.NEXT_PUBLIC_TG_ANALYTICS_APP_NAME || 'r7app'

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramAnalytics token={analyticsToken} appName={analyticsAppName} />
        {children}
        <ClaimRewardPrompt />
        <Navigation />
      </body>
    </html>
  );
}

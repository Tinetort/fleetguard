import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistry from "@/components/service-worker-registry";
import { Toaster } from "sonner";
import { getSession } from "../lib/auth";
import { getOrgBranding } from "../lib/branding";
import { BrandingProvider } from "../lib/branding-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "Rig Check",
  description: "Progressive Web App for fleet inspections",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rig Check",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const branding = await getOrgBranding(session?.orgId);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BrandingProvider branding={branding}>
          <ServiceWorkerRegistry />
          {children}
          <Toaster position="top-right" richColors />
        </BrandingProvider>
      </body>
    </html>
  );
}

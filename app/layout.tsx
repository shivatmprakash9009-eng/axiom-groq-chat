import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TIWAT — Think clearly. Move faster.",
  description: "A calm, intelligent workspace for your ideas, research, and work.",
  applicationName: "TIWAT",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://axiom-groq-chat.vercel.app"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TIWAT",
  },
  icons: {
    icon: [{ url: "/icons/tiwat-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/tiwat-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "TIWAT — Think clearly. Move faster.",
    description: "A calm, intelligent workspace for your ideas, research, and work.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={geistSans.variable + " " + geistMono.variable}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
        <PwaInstallPrompt />
      </body>
    </html>
  );
}

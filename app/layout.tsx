import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raso Minang — Restoran Padang",
  description: "Menu dan reservasi restoran Padang Raso Minang dengan Payment Gateway Midtrans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const clientKey = (
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
    ""
  ).trim();

  // Auto-detect if production or sandbox
  const isExplicitProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const isExplicitSandbox = process.env.MIDTRANS_IS_PRODUCTION === "false";
  const isProduction = isExplicitSandbox
    ? false
    : isExplicitProd || (clientKey.startsWith("Mid-client-") && !clientKey.startsWith("SB-"));

  const defaultSnapUrl = isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

  const snapUrl = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || defaultSnapUrl;

  return (
    <html lang="id">
      <head>
        <Script
          id="midtrans-snap"
          src={snapUrl}
          data-client-key={clientKey}
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

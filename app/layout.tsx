import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raso Minang — Restoran Padang",
  description: "Menu dan reservasi restoran Padang Raso Minang.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}

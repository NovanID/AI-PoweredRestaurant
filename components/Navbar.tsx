"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRestaurant } from "../lib/use-restaurant";

interface NavbarProps {
  onOpenTrackModal?: () => void;
  activeSection?: string;
}

export default function Navbar({ onOpenTrackModal }: NavbarProps) {
  const { reservations, isClient } = useRestaurant();
  const [activeUserBookingCount, setActiveUserBookingCount] = useState(0);

  useEffect(() => {
    if (!isClient) return;
    try {
      const stored = localStorage.getItem("rm_recent_reservations");
      if (stored) {
        const codes: string[] = JSON.parse(stored);
        const activeCount = reservations.filter(
          (r) => codes.includes(r.code) && (r.status === "pending" || r.status === "confirmed" || r.status === "seated")
        ).length;
        setActiveUserBookingCount(activeCount);
      }
    } catch {
      setActiveUserBookingCount(0);
    }
  }, [reservations, isClient]);

  return (
    <header className="sticky top-0 z-40 bg-[#fffaf0]/95 backdrop-blur-md border-b border-[#eadfca]/80 transition-all shadow-xs">
      <div className="shell min-h-[64px] sm:min-h-[72px] flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3 group" aria-label="Beranda Raso Minang">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8f1d20] to-[#6a1215] flex items-center justify-center text-[#d8a43b] shadow-md shadow-[#8f1d20]/20 font-serif font-bold text-xl group-hover:scale-105 transition-transform shrink-0">
            RM
          </div>
          <div>
            <span className="font-serif text-2xl font-bold text-[#8f1d20] tracking-tight block leading-none">
              Raso Minang
            </span>
            <span className="hidden sm:block text-[10px] uppercase font-bold tracking-widest text-[#d8a43b] mt-0.5">
              Restoran Padang Autentik
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-6 font-bold text-xs sm:text-sm text-[#74635c]" aria-label="Navigasi Utama">
          <a
            href="#menu"
            className="hover:text-[#8f1d20] transition-colors py-2 px-1 focus:outline-none"
          >
            Menu
          </a>
          <a
            href="#reservasi"
            className="hover:text-[#8f1d20] transition-colors py-2 px-1 focus:outline-none"
          >
            Reservasi
          </a>

          {onOpenTrackModal && (
            <button
              onClick={onOpenTrackModal}
              aria-label={activeUserBookingCount > 0 ? `Lacak Tiket (${activeUserBookingCount} tiket aktif)` : "Lacak Tiket Reservasi"}
              className="inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#8f1d20]/25 text-[#8f1d20] bg-white hover:bg-[#8f1d20]/5 transition-all shadow-xs cursor-pointer focus:outline-none"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs font-bold">Lacak Tiket</span>
              {activeUserBookingCount > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </button>
          )}

          <Link
            href="/admin"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#261b17] text-white hover:bg-[#8f1d20] transition-all shadow-sm text-xs font-semibold"
          >
            <span>Staff Portal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8a43b] animate-pulse"></span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

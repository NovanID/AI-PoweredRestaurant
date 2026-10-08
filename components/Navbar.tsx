"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRestaurant } from "../lib/use-restaurant";
import { useTenant } from "../lib/tenant-context";

interface NavbarProps {
  onOpenTrackModal?: () => void;
  onOpenAIChat?: () => void;
  activeSection?: string;
}

export default function Navbar({ onOpenTrackModal, onOpenAIChat }: NavbarProps) {
  const { isClient, profile } = useRestaurant();
  const { branding, basePath } = useTenant();
  const [activeUserBookingCount, setActiveUserBookingCount] = useState(0);

  useEffect(() => {
    if (!isClient) return;
    // Storefront no longer exposes the reservation list publicly; show the
    // count of recently-tracked ticket codes saved on this device instead.
    try {
      const stored = localStorage.getItem("rm_recent_reservations");
      if (stored) {
        const codes: string[] = JSON.parse(stored);
        setActiveUserBookingCount(codes.length);
      }
    } catch {
      setActiveUserBookingCount(0);
    }
  }, [isClient]);

  const restaurantName = profile.name && profile.name !== "..." ? profile.name : "Restoran";

  return (
    <header className="sticky top-0 z-40 bg-[var(--brand-bg)]/95 backdrop-blur-md border-b border-[var(--brand-border)]/80 transition-all shadow-xs">
      <div className="shell min-h-[64px] sm:min-h-[72px] flex items-center justify-between gap-3">
        <Link href={basePath || "/"} className="flex items-center gap-3 group" aria-label={`Beranda ${restaurantName}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center text-[var(--brand-accent)] shadow-md shadow-[var(--brand-primary)]/20 font-serif font-bold text-xl group-hover:scale-105 transition-transform shrink-0">
            {branding.logoInitials}
          </div>
          <div>
            <span className="font-serif text-2xl font-bold text-[var(--brand-primary)] tracking-tight block leading-none">
              {restaurantName}
            </span>
            <span className="hidden sm:block text-[10px] uppercase font-bold tracking-widest text-[var(--brand-accent)] mt-0.5">
              {branding.navSubtitle}
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4 font-bold text-xs sm:text-sm text-[var(--brand-muted)]" aria-label="Navigasi Utama">
          <a
            href="#menu"
            className="hover:text-[var(--brand-primary)] transition-colors py-2 px-1 focus:outline-none hidden md:block"
          >
            Menu
          </a>
          <a
            href="#reservasi"
            className="hover:text-[var(--brand-primary)] transition-colors py-2 px-1 focus:outline-none hidden md:block"
          >
            Reservasi
          </a>

          {/* High-visibility AI Spearhead Button */}
          {onOpenAIChat && (
            <button
              onClick={onOpenAIChat}
              aria-label={`Tanya ${branding.chatPersonaLabel}`}
              className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] text-[var(--brand-accent-light)] hover:text-white border border-[var(--brand-accent)]/40 shadow-sm shadow-[var(--brand-primary)]/20 hover:scale-105 transition-all cursor-pointer focus:outline-none"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-bold tracking-wide">✨ Tanya AI</span>
            </button>
          )}

          {onOpenTrackModal && (
            <button
              onClick={onOpenTrackModal}
              aria-label={activeUserBookingCount > 0 ? `Lacak Tiket (${activeUserBookingCount} tiket aktif)` : "Lacak Tiket Reservasi"}
              className="inline-flex min-h-[40px] items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--brand-primary)]/25 text-[var(--brand-primary)] bg-white hover:bg-[var(--brand-primary)]/5 transition-all shadow-xs cursor-pointer focus:outline-none"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs font-bold hidden xs:inline">Lacak</span>
              <span className="text-xs font-bold xs:hidden">Tiket</span>
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
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--brand-ink)] text-white hover:bg-[var(--brand-primary)] transition-all shadow-sm text-xs font-semibold"
          >
            <span>Staff Portal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)] animate-pulse"></span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

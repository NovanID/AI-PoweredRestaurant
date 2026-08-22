"use client";

import Link from "next/link";

interface NavbarProps {
  onOpenTrackModal?: () => void;
  activeSection?: string;
}

export default function Navbar({ onOpenTrackModal }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#fffaf0]/90 backdrop-blur-md border-b border-[#eadfca]/80 transition-all">
      <div className="shell min-h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8f1d20] to-[#6a1215] flex items-center justify-center text-[#d8a43b] shadow-md shadow-[#8f1d20]/20 font-serif font-bold text-xl group-hover:scale-105 transition-transform">
            RM
          </div>
          <div>
            <span className="font-serif text-2xl font-bold text-[#8f1d20] tracking-tight block leading-none">
              Raso Minang
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#d8a43b]">
              Restoran Padang Autentik
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6 font-bold text-xs sm:text-sm text-[#74635c]" aria-label="Navigasi Utama">
          <a
            href="#menu"
            className="hover:text-[#8f1d20] transition-colors py-2"
          >
            Katalog Menu
          </a>
          <a
            href="#reservasi"
            className="hover:text-[#8f1d20] transition-colors py-2"
          >
            Reservasi Meja
          </a>
          {onOpenTrackModal && (
            <button
              onClick={onOpenTrackModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8f1d20]/20 text-[#8f1d20] hover:bg-[#8f1d20]/5 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Lacak Tiket</span>
            </button>
          )}
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#261b17] text-white hover:bg-[#8f1d20] transition-all shadow-sm text-xs font-semibold"
          >
            <span>Staff Portal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8a43b] animate-pulse"></span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

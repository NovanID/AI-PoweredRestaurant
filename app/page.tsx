"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import MenuSection from "../components/MenuSection";
import ReservationSection from "../components/ReservationSection";
import TrackReservationModal from "../components/TrackReservationModal";
import AIChatWidget from "../components/AIChatWidget";
import { useRestaurant } from "../lib/use-restaurant";

export default function Home() {
  const { profile } = useRestaurant();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackCode, setTrackCode] = useState("");

  const handleOpenTrackWithCode = (code: string) => {
    setTrackCode(code);
    setIsTrackModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf0] text-[#261b17]">
      {/* Top Navigation */}
      <Navbar onOpenTrackModal={() => { setTrackCode(""); setIsTrackModalOpen(true); }} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="hero shell py-16 md:py-24" id="top">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8f1d20]/10 border border-[#8f1d20]/20 text-[#8f1d20] text-xs font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#8f1d20]"></span>
              Warisan Kuliner Minangkabau Asli
            </div>

            <h1 className="font-serif font-bold text-4xl sm:text-6xl lg:text-7xl leading-[1.05] text-[#261b17] tracking-tight">
              Rasa Minang,<br />
              <span className="text-[#8f1d20]">Hangat</span> di Setiap Meja.
            </h1>

            <p className="text-base sm:text-lg text-[#74635c] max-w-xl leading-relaxed">
              Nikmati kelezatan Rendang 8 Jam, Ayam Pop Gurih, dan aneka hidangan Minang pilihan. Reservasi meja Anda dalam hitungan detik tanpa antre.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#reservasi"
                className="px-7 py-3.5 rounded-xl bg-[#8f1d20] hover:bg-[#731518] text-white font-bold text-sm shadow-xl shadow-[#8f1d20]/25 transition-all hover:scale-105 cursor-pointer"
              >
                Pesan Meja Sekarang
              </a>
              <a
                href="#menu"
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-[#fffaf0] text-[#74635c] hover:text-[#8f1d20] border border-[#eadfca] font-bold text-sm transition-all shadow-sm cursor-pointer"
              >
                Jelajahi Menu
              </a>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#eadfca] max-w-lg text-xs">
              <div>
                <strong className="block text-base font-serif text-[#8f1d20]">100%</strong>
                <span className="text-[#74635c]">Rempah Alami</span>
              </div>
              <div>
                <strong className="block text-base font-serif text-[#8f1d20]">10 Meja</strong>
                <span className="text-[#74635c]">Indoor, Outdoor & VIP</span>
              </div>
              <div>
                <strong className="block text-base font-serif text-[#8f1d20]">AI Assisted</strong>
                <span className="text-[#74635c]">Booking Real-Time</span>
              </div>
            </div>
          </div>

          {/* Hero Card */}
          <div className="hero-card relative p-8 md:p-10 rounded-3xl bg-gradient-to-br from-[#8f1d20] to-[#6a1215] text-white shadow-2xl shadow-[#8f1d20]/30 border border-[#d8a43b]/30">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-[#ffd98a]">
                  Status Restoran
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Buka Hari Ini
                </span>
              </div>

              <div>
                <span className="text-xs text-white/80 block">Jam Operasional</span>
                <strong className="font-serif text-3xl md:text-4xl text-[#ffd98a] block mt-1">
                  {profile.openTime} – {profile.closeTime} WIB
                </strong>
                <p className="text-xs text-white/70 mt-1">Melayani santap di tempat (Dine-in) & Reservasi</p>
              </div>

              <div className="pt-2 border-t border-white/15 space-y-2 text-xs text-white/90">
                <p className="flex items-start gap-2">
                  <span>📍</span>
                  <span>{profile.address}, {profile.city}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span>📞</span>
                  <span>WhatsApp: {profile.phone}</span>
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsTrackModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/20 transition-all text-center cursor-pointer"
                >
                  Punya Kode Reservasi? Cek Tiket di Sini →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Menu Catalog Section */}
        <MenuSection />

        {/* Interactive Reservation Section */}
        <ReservationSection onOpenTrackModalWithCode={handleOpenTrackWithCode} />
      </main>

      {/* Footer */}
      <footer className="bg-[#261b17] text-[#eadfca] py-12 border-t border-[#3d2c26]">
        <div className="shell flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
          <div className="space-y-1 text-center md:text-left">
            <strong className="font-serif text-xl text-[#ffd98a] block">Raso Minang</strong>
            <p className="text-[#a3948e]">{profile.address}, {profile.city}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-xs text-[#d8a43b] font-semibold">
            <a href="#top" className="hover:text-white transition-colors">Beranda</a>
            <a href="#menu" className="hover:text-white transition-colors">Menu</a>
            <a href="#reservasi" className="hover:text-white transition-colors">Reservasi</a>
            <button
              onClick={() => setIsTrackModalOpen(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Lacak Tiket
            </button>
          </div>
          <div className="text-center md:text-right text-[#a3948e]">
            <p>Prototype AI-Powered Restaurant · 2026</p>
            <p className="text-[10px] text-[#74635c]">Single Source of Truth · Tenant-Aware Architecture</p>
          </div>
        </div>
      </footer>

      {/* Modals & Floating Widgets */}
      <TrackReservationModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        initialCode={trackCode}
      />

      <AIChatWidget onTrackReservation={handleOpenTrackWithCode} />
    </div>
  );
}

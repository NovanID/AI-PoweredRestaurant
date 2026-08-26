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
  const [initialReservationNote, setInitialReservationNote] = useState("");

  // AI Chatbot Spotlight State
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [aiExternalPrompt, setAiExternalPrompt] = useState("");
  const [heroPromptInput, setHeroPromptInput] = useState("");

  const handleOpenTrackWithCode = (code: string) => {
    setTrackCode(code);
    setIsTrackModalOpen(true);
  };

  const handleSelectMenuForReservation = (dishName: string) => {
    setInitialReservationNote(`Ingin memesan menu favorit: ${dishName}`);
    const el = document.getElementById("reservasi");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleTriggerAIChat = (customPrompt?: string) => {
    if (customPrompt && customPrompt.trim()) {
      setAiExternalPrompt(customPrompt.trim());
    }
    setIsAIChatOpen(true);
  };

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroPromptInput.trim()) {
      handleTriggerAIChat(heroPromptInput.trim());
      setHeroPromptInput("");
    } else {
      handleTriggerAIChat();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf0] text-[#261b17]">
      {/* Top Navigation */}
      <Navbar
        onOpenTrackModal={() => { setTrackCode(""); setIsTrackModalOpen(true); }}
        onOpenAIChat={() => handleTriggerAIChat()}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="hero shell grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center py-12 md:py-20" id="top">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8f1d20]/10 border border-[#8f1d20]/20 text-[#8f1d20] text-xs font-extrabold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#8f1d20]"></span>
                Warisan Kuliner Minangkabau Asli
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <span>🟢</span> 100% Halal
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shadow-2xs">
                <span>⚡</span> AI Real-Time Booking
              </div>
            </div>

            <h1 className="font-serif font-bold text-4xl sm:text-6xl lg:text-7xl leading-[1.05] text-[#261b17] tracking-tight">
              Rasa Minang,<br />
              <span className="text-[#8f1d20]">Hangat</span> di Setiap Meja.
            </h1>

            <p className="text-base sm:text-lg text-[#74635c] max-w-xl leading-relaxed">
              Nikmati kelezatan Rendang 8 Jam, Ayam Pop Gurih, dan aneka hidangan Minang pilihan. Reservasi meja dan konsultasi menu instan dipandu oleh Asisten AI pintar kami.
            </p>

            {/* AI Concierge Interactive Command Spotlight */}
            <div className="p-5 rounded-3xl bg-white border-2 border-[#d8a43b]/60 shadow-xl shadow-[#8f1d20]/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-xs sm:text-sm text-[#8f1d20] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>✨ Asisten AI Raso Minang (Tanya Menu & Meja Instan)</span>
                </span>
                <span className="text-[10px] text-[#74635c] font-semibold uppercase tracking-wider hidden sm:inline">
                  Terhubung Live
                </span>
              </div>

              {/* Quick AI Search Form */}
              <form onSubmit={handleHeroSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tanyakan apa saja (contoh: 'Cek meja 4 orang besok', 'Rekomendasi pedas', dll)..."
                  value={heroPromptInput}
                  onChange={(e) => setHeroPromptInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#d8cbbb] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#d8a43b] transition-all bg-[#fffaf0]/60"
                />
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-2.5 rounded-xl bg-[#8f1d20] hover:bg-[#731518] text-white text-xs font-bold transition-all shadow-md shadow-[#8f1d20]/25 cursor-pointer shrink-0 flex items-center gap-1.5 hover:scale-105"
                >
                  <span>Tanya AI</span>
                  <span>⚡</span>
                </button>
              </form>

              {/* 1-Tap Quick AI Prompt Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-[#74635c] mr-1">Coba Tanya:</span>
                {[
                  { label: "🪑 Meja 4 Org Besok Jam 19.00", query: "Ada meja kosong untuk 4 orang besok jam 19.00?" },
                  { label: "🥘 Rekomendasi Menu Favorit", query: "Apa saja menu rekomendasi dan terpopuler di Raso Minang?" },
                  { label: "👑 Info Ruangan VIP", query: "Apakah ada ruangan VIP untuk acara keluarga atau kantor?" },
                  { label: "💳 Cara Pembayaran DP", query: "Bagaimana cara pembayaran deposit via QRIS/Midtrans?" },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleTriggerAIChat(chip.query)}
                    className="px-2.5 py-1 rounded-full bg-[#fffaf0] hover:bg-[#8f1d20] text-[#74635c] hover:text-white border border-[#d8a43b]/40 text-[11px] font-medium transition-all cursor-pointer shadow-2xs"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Standard CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <a
                href="#reservasi"
                className="px-7 py-3.5 rounded-xl bg-[#8f1d20] hover:bg-[#731518] text-white font-bold text-sm shadow-xl shadow-[#8f1d20]/25 transition-all hover:scale-105 cursor-pointer"
              >
                Pesan Meja Mandiri
              </a>
              <a
                href="#menu"
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-[#fffaf0] text-[#74635c] hover:text-[#8f1d20] border border-[#eadfca] font-bold text-sm transition-all shadow-sm cursor-pointer"
              >
                Jelajahi Menu Tradisi
              </a>
            </div>
          </div>

          {/* Hero Right Card */}
          <div className="lg:col-span-5">
            <div className="hero-card relative p-8 rounded-3xl bg-gradient-to-br from-[#8f1d20] via-[#7d191c] to-[#6a1215] text-white shadow-2xl shadow-[#8f1d20]/30 border border-[#d8a43b]/40 space-y-6">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-[#ffd98a] flex items-center gap-1.5">
                  <span>🏛️</span> Layanan Restoran
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Buka Hari Ini
                </span>
              </div>

              {/* Spotlight AI Feature Badge */}
              <div className="p-4 rounded-2xl bg-white/10 border border-white/20 space-y-2 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#ffd98a] flex items-center gap-1.5">
                    <span>✨</span> Chatbot Asisten Cerdas
                  </span>
                  <span className="text-[10px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-full">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">
                  Tidak mau repot isi form panjang? Percayakan reservasi meja dan rekomendasi hidangan ke AI Asisten kami.
                </p>
                <button
                  type="button"
                  onClick={() => handleTriggerAIChat("Halo Asisten AI, saya ingin reservasi meja")}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-[#d8a43b] hover:bg-[#c49230] text-[#261b17] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>Mulai Percakapan AI Sekarang</span>
                  <span>→</span>
                </button>
              </div>

              <div>
                <span className="text-xs text-white/80 block">Jam Operasional</span>
                <strong className="font-serif text-2xl sm:text-3xl text-[#ffd98a] block mt-0.5">
                  {profile.openTime} – {profile.closeTime} WIB
                </strong>
                <p className="text-xs text-white/70 mt-1">Dine-in, Takeaway & Reservasi Online</p>
              </div>

              <div className="pt-2 border-t border-white/15 space-y-1.5 text-xs text-white/90">
                <p className="flex items-start gap-2">
                  <span>📍</span>
                  <span>{profile.address}, {profile.city}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span>📞</span>
                  <span>WhatsApp: {profile.phone}</span>
                </p>
              </div>

              <div className="pt-1">
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
        <MenuSection
          onSelectMenuItem={handleSelectMenuForReservation}
          onAskAI={(prompt) => handleTriggerAIChat(prompt)}
        />

        {/* Interactive Reservation Section */}
        <ReservationSection
          onOpenTrackModalWithCode={handleOpenTrackWithCode}
          initialNote={initialReservationNote}
        />
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
            <a href="#menu" className="hover:text-white transition-colors">Daftar Menu</a>
            <a href="#reservasi" className="hover:text-white transition-colors">Reservasi Meja</a>
            <button
              onClick={() => handleTriggerAIChat()}
              className="text-[#ffd98a] hover:text-white font-bold cursor-pointer"
            >
              ✨ Tanya Asisten AI
            </button>
            <button
              onClick={() => setIsTrackModalOpen(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Lacak Tiket
            </button>
          </div>
          <div className="text-center md:text-right text-[#74635c] text-[11px]">
            <p>© {new Date().getFullYear()} Restoran Raso Minang. Hak Cipta Dilindungi.</p>
            <p className="text-[#a3948e] mt-0.5">Sistem Terintegrasi Midtrans & AI Virtual Concierge.</p>
          </div>
        </div>
      </footer>

      {/* Track & Manage Reservation Modal */}
      <TrackReservationModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        initialCode={trackCode}
      />

      {/* AI Chatbot Virtual Assistant (Flagship Feature) */}
      <AIChatWidget
        onTrackReservation={handleOpenTrackWithCode}
        isOpenControlled={isAIChatOpen}
        onOpenChange={(open) => setIsAIChatOpen(open)}
        externalPrompt={aiExternalPrompt}
        onClearExternalPrompt={() => setAiExternalPrompt("")}
      />
    </div>
  );
}

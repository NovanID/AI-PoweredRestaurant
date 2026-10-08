"use client";

import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import MenuSection from "./MenuSection";
import ReservationSection from "./ReservationSection";
import TrackReservationModal from "./TrackReservationModal";
import AIChatWidget from "./AIChatWidget";
import { useRestaurant } from "../lib/use-restaurant";
import { useTenant } from "../lib/tenant-context";
import { setChatTenantId } from "../lib/ai-assistant-service";

/**
 * Tenant-aware storefront. All branding copy comes from TenantContext
 * (lib/tenants.ts) and live data from PostgreSQL via /api/storefront/data.
 * Rendered by both `/` (default tenant) and `/t/[slug]` (explicit tenant).
 */
export default function Storefront() {
  const { profile } = useRestaurant();
  const { tenantId, branding } = useTenant();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackCode, setTrackCode] = useState("");
  const [initialReservationNote, setInitialReservationNote] = useState("");

  // AI Chatbot Spotlight State
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [aiExternalPrompt, setAiExternalPrompt] = useState("");
  const [heroPromptInput, setHeroPromptInput] = useState("");

  // Bind the AI chat client session to THIS tenant (validated server-side too)
  useEffect(() => {
    setChatTenantId(tenantId);
    document.documentElement.setAttribute("data-tenant", tenantId);
    return () => document.documentElement.removeAttribute("data-tenant");
  }, [tenantId]);

  const restaurantName = profile.name && profile.name !== "..." ? profile.name : branding.chatPersonaLabel.replace("Asisten AI ", "");

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
    <div className="min-h-screen flex flex-col bg-[var(--brand-bg)] text-[var(--brand-ink)]">
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-xs font-extrabold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)]"></span>
                {branding.badgeText}
              </div>
              {branding.heroBadges.map((badge, idx) => (
                <div
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    idx === 0
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border border-amber-300 text-amber-900 shadow-2xs"
                  }`}
                >
                  {badge}
                </div>
              ))}
            </div>

            <h1 className="font-serif font-bold text-4xl sm:text-6xl lg:text-7xl leading-[1.05] text-[var(--brand-ink)] tracking-tight">
              {branding.heroTitle[0]}<br />
              <span className="text-[var(--brand-primary)]">{branding.heroTitle[1]}</span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--brand-muted)] max-w-xl leading-relaxed">
              {branding.heroDescription}
            </p>

            {/* AI Concierge Interactive Command Spotlight */}
            <div className="p-5 rounded-3xl bg-white border-2 border-[var(--brand-accent)]/60 shadow-xl shadow-[var(--brand-primary)]/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-xs sm:text-sm text-[var(--brand-primary)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>✨ {branding.chatPersonaLabel} (Tanya Menu & Meja Instan)</span>
                </span>
                <span className="text-[10px] text-[var(--brand-muted)] font-semibold uppercase tracking-wider hidden sm:inline">
                  Terhubung Live
                </span>
              </div>

              {/* Quick AI Search Form */}
              <form onSubmit={handleHeroSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tanyakan apa saja (contoh: 'Cek meja 4 orang besok', 'Rekomendasi menu', dll)..."
                  value={heroPromptInput}
                  onChange={(e) => setHeroPromptInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--brand-border-strong)] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition-all bg-[var(--brand-bg)]/60"
                />
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-2.5 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-xs font-bold transition-all shadow-md shadow-[var(--brand-primary)]/25 cursor-pointer shrink-0 flex items-center gap-1.5 hover:scale-105"
                >
                  <span>Tanya AI</span>
                  <span>⚡</span>
                </button>
              </form>

              {/* 1-Tap Quick AI Prompt Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-[var(--brand-muted)] mr-1">Coba Tanya:</span>
                {branding.quickPrompts.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleTriggerAIChat(chip.query)}
                    className="px-2.5 py-1 rounded-full bg-[var(--brand-bg)] hover:bg-[var(--brand-primary)] text-[var(--brand-muted)] hover:text-white border border-[var(--brand-accent)]/40 text-[11px] font-medium transition-all cursor-pointer shadow-2xs"
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
                className="px-7 py-3.5 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white font-bold text-sm shadow-xl shadow-[var(--brand-primary)]/25 transition-all hover:scale-105 cursor-pointer"
              >
                Pesan Meja Mandiri
              </a>
              <a
                href="#menu"
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-[var(--brand-bg)] text-[var(--brand-muted)] hover:text-[var(--brand-primary)] border border-[var(--brand-border)] font-bold text-sm transition-all shadow-sm cursor-pointer"
              >
                Jelajahi Menu
              </a>
            </div>
          </div>

          {/* Hero Right Card */}
          <div className="lg:col-span-5">
            <div className="hero-card relative p-8 rounded-3xl bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-primary-mid)] to-[var(--brand-primary-dark)] text-white shadow-2xl shadow-[var(--brand-primary)]/30 border border-[var(--brand-accent)]/40 space-y-6">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--brand-accent-light)] flex items-center gap-1.5">
                  <span>🏛️</span> Layanan {restaurantName}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Buka Hari Ini
                </span>
              </div>

              {/* Spotlight AI Feature Badge */}
              <div className="p-4 rounded-2xl bg-white/10 border border-white/20 space-y-2 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--brand-accent-light)] flex items-center gap-1.5">
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
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-[var(--brand-ink)] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>Mulai Percakapan AI Sekarang</span>
                  <span>→</span>
                </button>
              </div>

              <div>
                <span className="text-xs text-white/80 block">Jam Operasional</span>
                <strong className="font-serif text-2xl sm:text-3xl text-[var(--brand-accent-light)] block mt-0.5">
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
      <footer className="bg-[var(--brand-ink)] text-[var(--brand-border)] py-12 border-t border-[var(--brand-footer-border)]">
        <div className="shell flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
          <div className="space-y-1 text-center md:text-left">
            <strong className="font-serif text-xl text-[var(--brand-accent-light)] block">{restaurantName}</strong>
            <p className="text-[var(--brand-muted-2)]">{profile.address}, {profile.city}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-xs text-[var(--brand-accent)] font-semibold">
            <a href="#top" className="hover:text-white transition-colors">Beranda</a>
            <a href="#menu" className="hover:text-white transition-colors">Daftar Menu</a>
            <a href="#reservasi" className="hover:text-white transition-colors">Reservasi Meja</a>
            <button
              onClick={() => handleTriggerAIChat()}
              className="text-[var(--brand-accent-light)] hover:text-white font-bold cursor-pointer"
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
          <div className="text-center md:text-right text-[var(--brand-muted)] text-[11px]">
            <p>© {new Date().getFullYear()} {restaurantName}. Hak Cipta Dilindungi.</p>
            <p className="text-[var(--brand-muted-2)] mt-0.5">Sistem Terintegrasi Midtrans & AI Virtual Concierge.</p>
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

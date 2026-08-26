"use client";

import { useState, useMemo } from "react";
import { useRestaurant } from "../lib/use-restaurant";
import { MenuCategory } from "../types/restaurant";

const CATEGORIES: Array<MenuCategory | "Semua"> = [
  "Semua",
  "Lauk Utama",
  "Sayur & Kuah",
  "Pelengkap & Sambal",
  "Minuman",
];

interface MenuSectionProps {
  onSelectMenuItem?: (dishName: string) => void;
  onAskAI?: (prompt: string) => void;
}

export default function MenuSection({ onSelectMenuItem, onAskAI }: MenuSectionProps) {
  const { menu } = useRestaurant();
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | "Semua">("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    return menu.filter((item) => {
      if (selectedCategory !== "Semua" && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        return matchName || matchDesc || matchCat;
      }
      return true;
    });
  }, [menu, selectedCategory, searchQuery]);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getSpiceBadge = (level?: number) => {
    if (!level || level <= 0) return { label: "Non-Pedas", icon: "🌱", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (level === 1) return { label: "Pedas Ringan", icon: "🌶️", color: "bg-amber-50 text-amber-800 border-amber-200" };
    if (level === 2) return { label: "Pedas Sedang", icon: "🌶️🌶️", color: "bg-orange-50 text-orange-800 border-orange-200" };
    return { label: "Pedas Mantap", icon: "🌶️🌶️🌶️", color: "bg-red-50 text-red-800 border-red-200" };
  };

  const isFilterActive = selectedCategory !== "Semua" || searchQuery.trim() !== "";

  return (
    <section className="shell py-16 md:py-20" id="menu">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <p className="eyebrow">Pilihan Hidangan Tradisi</p>
        <h2 className="text-3xl md:text-5xl font-serif font-bold text-[#8f1d20] mb-4">
          Cita Rasa Otentik Minang
        </h2>
        <p className="text-[#74635c] text-sm md:text-base leading-relaxed">
          Semua hidangan diolah harian dengan rempah segar tanpa pengawet. Status ketersediaan diperbarui langsung oleh dapur kami.
        </p>
      </div>

      {/* AI Sommelier Recommendation Banner */}
      {onAskAI && (
        <div className="mb-8 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#8f1d20]/10 via-[#d8a43b]/15 to-[#8f1d20]/5 border border-[#d8a43b]/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-2xl bg-[#8f1d20] text-[#ffd98a] flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              ✨
            </div>
            <div>
              <p className="text-xs font-bold text-[#8f1d20] uppercase tracking-wider">
                Bingung Pilih Menu untuk Rombongan?
              </p>
              <p className="text-xs text-[#74635c]">
                Tanyakan kombinasi lauk terfavorit, opsi non-pedas, atau paket santap keluarga ke Asisten AI kami.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onAskAI("Rekomendasikan paket menu makan terbaik untuk 4 orang di Raso Minang")}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#8f1d20] hover:bg-[#731518] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 hover:scale-105"
          >
            <span>Tanya Rekomendasi Menu ke AI</span>
            <span>⚡</span>
          </button>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            aria-label="Cari menu"
            placeholder="Cari Rendang, Ayam Pop, Sambal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-full border border-[#d8cbbb] bg-white text-[#261b17] text-sm focus:outline-none focus:ring-2 focus:ring-[#d8a43b] focus:border-transparent transition-all shadow-xs"
          />
          <svg
            className="w-4 h-4 text-[#74635c] absolute left-3.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Hapus pencarian"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#74635c] hover:text-[#8f1d20] p-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#8f1d20] text-white shadow-md shadow-[#8f1d20]/20"
                  : "bg-white text-[#74635c] border border-[#eadfca] hover:border-[#8f1d20]/40 hover:text-[#8f1d20]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Status Bar */}
      <div className="flex items-center justify-between text-xs text-[#74635c] mb-8 pb-3 border-b border-[#eadfca]/60 px-1">
        <span>
          Menampilkan <strong>{filteredItems.length}</strong> dari {menu.length} hidangan
          {selectedCategory !== "Semua" && ` (Kategori: ${selectedCategory})`}
        </span>
        {isFilterActive && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("Semua");
            }}
            className="text-xs font-bold text-[#8f1d20] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Bersihkan Filter</span>
            <span>✕</span>
          </button>
        )}
      </div>

      {/* Menu Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white/70 rounded-3xl border border-dashed border-[#d8cbbb] space-y-3">
          <div className="text-3xl">🍲</div>
          <p className="text-[#261b17] font-bold text-base">
            Tidak ada menu yang sesuai dengan pencarian Anda
          </p>
          <p className="text-xs text-[#74635c] max-w-sm mx-auto">
            Coba gunakan kata kunci umum seperti &quot;Rendang&quot;, &quot;Ayam&quot;, atau pilih kategori &quot;Semua&quot;.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("Semua");
            }}
            className="px-5 py-2 rounded-xl bg-[#8f1d20] text-white text-xs font-bold hover:bg-[#731518] transition-colors cursor-pointer"
          >
            Tampilkan Semua Menu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const spice = getSpiceBadge(item.spicinessLevel);
            return (
              <article
                key={item.id}
                className={`group flex flex-col justify-between p-6 rounded-3xl border transition-all duration-200 ${
                  item.isAvailable
                    ? "bg-white border-[#eadfca] hover:border-[#d8a43b] hover:shadow-xl hover:shadow-[#d8a43b]/10"
                    : "bg-[#f5f1eb]/70 border-[#e2d8cb] opacity-75"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          item.isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-neutral-100 text-neutral-500 border-neutral-200"
                        }`}
                      >
                        {item.isAvailable ? "✓ Tersedia" : "✕ Habis Hari Ini"}
                      </span>
                      {item.isPopular && (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#d8a43b]/15 text-[#8f1d20] border border-[#d8a43b]/30">
                          ★ Favorit
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${spice.color}`}>
                        {spice.icon} {spice.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#74635c] uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>

                  <div className="mb-2">
                    <h3 className="font-serif text-xl font-bold text-[#261b17] group-hover:text-[#8f1d20] transition-colors leading-snug">
                      {item.name}
                    </h3>
                  </div>

                  <p className="text-xs md:text-sm text-[#74635c] leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#f1e6d4] mt-auto gap-2">
                  <strong className="font-serif text-xl text-[#8f1d20] font-bold">
                    {formatPrice(item.price)}
                  </strong>

                  {onSelectMenuItem ? (
                    <button
                      type="button"
                      onClick={() => onSelectMenuItem(item.name)}
                      disabled={!item.isAvailable}
                      className="px-3.5 py-1.5 rounded-xl bg-[#fffaf0] hover:bg-[#8f1d20] text-[#8f1d20] hover:text-white border border-[#8f1d20]/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-2xs"
                    >
                      <span>Pesan di Meja</span>
                      <span>→</span>
                    </button>
                  ) : (
                    <a
                      href="#reservasi"
                      className="text-xs font-bold text-[#74635c] group-hover:text-[#8f1d20] flex items-center gap-1 transition-colors"
                    >
                      <span>Pesan Meja</span>
                      <span>→</span>
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

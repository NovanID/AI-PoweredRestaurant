"use client";

import { useState } from "react";
import Link from "next/link";
import { useRestaurant } from "../lib/use-restaurant";
import { ReservationStatus, TableStatus } from "../types/restaurant";

type AdminTab = "reservations" | "tables" | "menu" | "audit";

export default function AdminDashboard() {
  const {
    isClient,
    profile,
    tables,
    menu,
    reservations,
    auditEvents,
    updateReservationStatus,
    updateTableStatus,
    toggleMenuAvailability,
    markAsSeated,
    markAsCompleted,
    markAsNoShow,
    autoReleaseExpiredLocks,
    resetToDefaults,
  } = useRestaurant();

  const [activeTab, setActiveTab] = useState<AdminTab>("reservations");
  const [reservationFilter, setReservationFilter] = useState<ReservationStatus | "all">("all");
  const [selectedStaff, setSelectedStaff] = useState("Staff Dapur & Kasir (Budi)");
  const [rejectingCode, setRejectingCode] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const confirmedCount = reservations.filter((r) => r.status === "confirmed").length;
  const seatedCount = reservations.filter((r) => r.status === "seated").length;
  const completedCount = reservations.filter((r) => r.status === "completed").length;
  const pendingCount = reservations.filter((r) => r.status === "pending").length;

  const totalDepositCollected = reservations
    .filter((r) => r.paymentStatus === "settlement")
    .reduce((sum, r) => sum + (r.paymentAmount || 50000), 0);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(""), 4000);
  };

  const handleCheckinSeated = (code: string) => {
    const res = markAsSeated(code, selectedStaff);
    if (res.success) showFeedback(res.message);
  };

  const handleCompleteDining = (code: string) => {
    const res = markAsCompleted(code, selectedStaff);
    if (res.success) showFeedback(res.message);
  };

  const handleMarkNoShow = (code: string) => {
    const res = markAsNoShow(code, selectedStaff, "Tamu tidak hadir melewati batas toleransi");
    if (res.success) showFeedback(res.message);
  };

  const handleCancel = (code: string) => {
    const res = updateReservationStatus(code, "cancelled", selectedStaff, "Dibatalkan oleh staf restoran");
    if (res.success) showFeedback(res.message);
  };

  const handleConfirmManual = (code: string) => {
    const res = updateReservationStatus(code, "confirmed", selectedStaff);
    if (res.success) showFeedback(res.message);
  };

  const handleReject = (code: string) => {
    const res = updateReservationStatus(
      code,
      "rejected",
      selectedStaff,
      rejectReason.trim() || "Kapasitas dapur/meja penuh pada jam tersebut"
    );
    if (res.success) {
      showFeedback(res.message);
      setRejectingCode(null);
      setRejectReason("");
    }
  };

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const filteredReservations = reservations.filter((r) => {
    if (reservationFilter === "all") return true;
    return r.status === reservationFilter;
  });

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] text-[#261b17] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#8f1d20] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-[#74635c] font-semibold">Memuat Dashboard Staf...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1eb] text-[#261b17]">
      {/* Top Admin Header */}
      <header className="bg-[#261b17] text-white border-b border-[#3d2c26] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-[#ffd98a] transition-colors"
            >
              ← Kembali ke Web Customer
            </Link>
            <div className="h-4 w-px bg-white/20"></div>
            <div>
              <h1 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                <span>Dashboard Staf — {profile.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d8a43b] text-[#261b17] font-sans font-extrabold uppercase">
                  Tenant: {profile.tenantId}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-[#a3948e]">Staf Aktif:</span>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="Staff Kasir (Budi)" className="text-black">Staff Kasir (Budi)</option>
                <option value="Manager Restoran (Siti)" className="text-black">Manager Restoran (Siti)</option>
                <option value="Head Chef (Rizal)" className="text-black">Head Chef (Rizal)</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (confirm("Reset seluruh data ke kondisi awal seed data?")) {
                  resetToDefaults();
                  showFeedback("Data berhasil di-reset ke kondisi awal.");
                }
              }}
              className="px-2.5 py-1.5 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition-colors text-[11px] cursor-pointer"
            >
              Reset Demo
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toast Feedback */}
        {feedbackMsg && (
          <div className="p-4 rounded-2xl bg-emerald-700 text-white text-xs font-semibold shadow-lg flex items-center justify-between animate-fade-in">
            <span>✓ {feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg("")} className="text-white/80 hover:text-white">✕</button>
          </div>
        )}

        {/* Live Operational Metrics / Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#74635c]">Tamu Bersantap</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
            </div>
            <strong className="font-serif text-3xl font-bold text-[#8f1d20] block">
              {seatedCount} Meja
            </strong>
            <span className="text-[11px] text-[#74635c]">Status: Sedang Makan (Seated)</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#74635c]">Booking Terkunci (Auto)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <strong className="font-serif text-3xl font-bold text-emerald-700 block">
              {confirmedCount} Tiket
            </strong>
            <span className="text-[11px] text-[#74635c]">Siap Hadir Hari Ini</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#74635c]">Okupansi Meja</span>
              <span className="text-xs text-[#d8a43b] font-bold">
                {tables.filter((t) => t.status === "occupied").length}/{tables.length}
              </span>
            </div>
            <strong className="font-serif text-3xl font-bold text-[#261b17] block">
              {Math.round((tables.filter((t) => t.status === "occupied").length / tables.length) * 100)}%
            </strong>
            <span className="text-[11px] text-[#74635c]">
              {tables.filter((t) => t.status === "available").length} Meja Tersedia
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#74635c]">Deposit Terverifikasi</span>
              <span className="text-[11px] font-bold text-emerald-600">Midtrans</span>
            </div>
            <strong className="font-serif text-2xl sm:text-3xl font-bold text-[#8f1d20] block">
              {formatPrice(totalDepositCollected)}
            </strong>
            <span className="text-[11px] text-[#74635c]">Dari Reservasi Berhasil</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#d8cbbb] pb-4">
          <button
            onClick={() => setActiveTab("reservations")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "reservations"
                ? "bg-[#8f1d20] text-white shadow-md shadow-[#8f1d20]/20"
                : "bg-white text-[#74635c] border border-[#eadfca] hover:text-[#8f1d20]"
            }`}
          >
            <span>Manajemen Tamu & Tiket</span>
            {seatedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-[#261b17] text-[10px] font-extrabold">
                {seatedCount} Seated
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("tables")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "tables"
                ? "bg-[#8f1d20] text-white shadow-md shadow-[#8f1d20]/20"
                : "bg-white text-[#74635c] border border-[#eadfca] hover:text-[#8f1d20]"
            }`}
          >
            <span>Live Floor Plan & Meja ({tables.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("menu")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "menu"
                ? "bg-[#8f1d20] text-white shadow-md shadow-[#8f1d20]/20"
                : "bg-white text-[#74635c] border border-[#eadfca] hover:text-[#8f1d20]"
            }`}
          >
            <span>Kontrol Stok Menu ({menu.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "audit"
                ? "bg-[#8f1d20] text-white shadow-md shadow-[#8f1d20]/20"
                : "bg-white text-[#74635c] border border-[#eadfca] hover:text-[#8f1d20]"
            }`}
          >
            <span>Audit Trail ({auditEvents.length})</span>
          </button>
        </div>

        {/* Tab 1: Reservations Queue & Floor Operations */}
        {activeTab === "reservations" && (
          <div className="space-y-4">
            {/* Filter pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="font-bold text-[#74635c] shrink-0">Filter:</span>
              {(
                [
                  { id: "all", label: `Semua (${reservations.length})` },
                  { id: "confirmed", label: `Terkonfirmasi (${confirmedCount})` },
                  { id: "seated", label: `Sedang Makan (${seatedCount})` },
                  { id: "completed", label: `Selesai (${completedCount})` },
                  { id: "pending", label: `Pending (${pendingCount})` },
                  { id: "no_show", label: "No-Show" },
                  { id: "cancelled", label: "Dibatalkan" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setReservationFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    reservationFilter === tab.id
                      ? "bg-[#261b17] text-white shadow-sm"
                      : "bg-white text-[#74635c] border border-[#d8cbbb] hover:border-[#261b17]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* List */}
            {filteredReservations.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-[#d8cbbb]">
                <p className="text-sm text-[#74635c]">Tidak ada data reservasi dengan filter status ini.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredReservations.map((res) => (
                  <div
                    key={res.id}
                    className={`p-6 rounded-2xl border bg-white transition-all shadow-sm ${
                      res.status === "seated"
                        ? "border-amber-400 bg-amber-50/20 ring-2 ring-amber-400/20"
                        : res.status === "confirmed"
                        ? "border-emerald-200 hover:border-emerald-400"
                        : "border-[#eadfca]"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-serif text-2xl font-bold text-[#8f1d20]">
                            {res.code}
                          </span>

                          {/* Status Badge */}
                          {res.status === "confirmed" && (
                            <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Terkonfirmasi (Auto)
                            </span>
                          )}

                          {res.status === "seated" && (
                            <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                              Sedang Bersantap (Seated)
                            </span>
                          )}

                          {res.status === "completed" && (
                            <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                              ✓ Selesai
                            </span>
                          )}

                          {res.status === "no_show" && (
                            <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                              ⚠️ No-Show
                            </span>
                          )}

                          {res.status === "pending" && (
                            <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              ⏳ Menunggu Bayar
                            </span>
                          )}

                          {res.status === "cancelled" && (
                            <span className="text-[11px] font-extrabold px-3 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-300">
                              Dibatalkan
                            </span>
                          )}

                          {/* Payment Badge */}
                          {res.paymentStatus === "settlement" ? (
                            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                              💳 Deposit Lunas (Rp {res.paymentAmount?.toLocaleString("id-ID") || "50.000"})
                            </span>
                          ) : res.paymentStatus === "pending" ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              ⏳ Midtrans Pending
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                              🏪 Bayar di Restoran
                            </span>
                          )}

                          <span className="text-xs text-[#74635c]">
                            Dibuat: {new Date(res.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-[#74635c] block">Customer</span>
                            <strong className="text-[#261b17]">{res.customerName}</strong>
                            <span className="text-[#74635c] block text-[11px]">{res.customerPhone}</span>
                          </div>
                          <div>
                            <span className="text-[#74635c] block">Waktu Reservasi</span>
                            <strong className="text-[#261b17]">{res.date} · {res.time} WIB</strong>
                            {res.seatedAt && (
                              <span className="text-amber-700 block text-[10px]">
                                Duduk jam {new Date(res.seatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[#74635c] block">Meja & Tamu</span>
                            <strong className="text-[#8f1d20]">Meja {res.tableNumber} ({res.tableArea})</strong> — {res.guestCount} Tamu
                          </div>
                          {res.notes && (
                            <div>
                              <span className="text-[#74635c] block">Catatan</span>
                              <span className="text-[#261b17] italic text-[11px]">{res.notes}</span>
                            </div>
                          )}
                        </div>

                        {res.rejectionReason && (
                          <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                            <strong>Keterangan:</strong> {res.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Right: Operational Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#f1e6d4]">
                        {res.status === "confirmed" && (
                          <>
                            <button
                              onClick={() => handleCheckinSeated(res.code)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                            >
                              <span>🟢 Tamu Tiba (Seated)</span>
                            </button>

                            <a
                              href={`https://wa.me/${res.customerPhone.startsWith('0') ? '62' + res.customerPhone.slice(1) : res.customerPhone}?text=${encodeURIComponent(
                                `Halo Kak ${res.customerName},\n\nKami dari *Raso Minang* mengingatkan bahwa reservasi meja Anda (Kode: *${res.code}*) untuk ${res.guestCount} orang pada *${res.date} pukul ${res.time} WIB* (Meja ${res.tableNumber}) sudah siap dan terkunci ✅.\n\nSampai jumpa di restoran!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#261b17] text-xs font-bold border border-neutral-200 transition-colors"
                            >
                              <span>📲 WA Pengingat</span>
                            </a>

                            <button
                              onClick={() => handleMarkNoShow(res.code)}
                              className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-rose-50 hover:text-rose-700 text-neutral-600 text-xs font-medium cursor-pointer transition-colors"
                            >
                              No-Show
                            </button>

                            <button
                              onClick={() => handleCancel(res.code)}
                              className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-neutral-600 text-xs font-medium cursor-pointer"
                            >
                              Batalkan
                            </button>
                          </>
                        )}

                        {res.status === "seated" && (
                          <button
                            onClick={() => handleCompleteDining(res.code)}
                            className="px-4 py-2 rounded-xl bg-[#261b17] hover:bg-[#8f1d20] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                          >
                            <span>🔵 Selesai Makan (Kosongkan Meja)</span>
                          </button>
                        )}

                        {res.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleConfirmManual(res.code)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              ✓ Konfirmasi Manual
                            </button>
                            <button
                              onClick={() => setRejectingCode(res.code)}
                              className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-colors cursor-pointer"
                            >
                              ✕ Batalkan
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline Reject Form */}
                    {rejectingCode === res.code && (
                      <div className="mt-4 pt-4 border-t border-red-200 bg-red-50/50 p-4 rounded-xl space-y-3">
                        <p className="text-xs font-bold text-red-800">
                          Masukkan Alasan Pembatalan untuk {res.code}:
                        </p>
                        <input
                          type="text"
                          placeholder="Misal: Tamu meminta pembatalan atau meja maintenance..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-red-300 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(res.code)}
                            className="px-4 py-1.5 rounded-lg bg-red-700 text-white text-xs font-bold hover:bg-red-800 cursor-pointer"
                          >
                            Kirim Pembatalan
                          </button>
                          <button
                            onClick={() => {
                              setRejectingCode(null);
                              setRejectReason("");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live Floor Plan & Tables Status */}
        {activeTab === "tables" && (
          <div className="space-y-4">
            <div className="p-5 bg-[#fffaf0] rounded-2xl border border-[#eadfca] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#8f1d20]">
                  Live Floor Map & Kontrol Meja
                </h3>
                <p className="text-xs text-[#74635c]">
                  Denah meja real-time. Meja otomatis terisi saat tamu reservasi di-check-in (Seated) atau jika ada tamu Walk-In.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-[#74635c]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Kosong
                </span>
                <span className="inline-flex items-center gap-1 text-[#74635c]">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Terisi (Seated)
                </span>
                <span className="inline-flex items-center gap-1 text-[#74635c]">
                  <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span> Maintenance
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tables.map((tbl) => {
                const isOccupied = tbl.status === "occupied";
                const isMaintenance = tbl.status === "maintenance";
                const isAvailable = tbl.status === "available";

                // Check if any seated reservation is occupying this table
                const activeSeated = reservations.find(
                  (r) => r.tableId === tbl.id && r.status === "seated"
                );

                return (
                  <div
                    key={tbl.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-sm ${
                      isOccupied
                        ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30"
                        : isMaintenance
                        ? "bg-neutral-100 border-neutral-300 opacity-70"
                        : "bg-white border-[#eadfca]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-serif text-2xl font-bold text-[#8f1d20]">
                          {tbl.number}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                            tbl.area === "VIP"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : tbl.area === "Outdoor"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : "bg-blue-100 text-blue-900 border border-blue-300"
                          }`}
                        >
                          {tbl.area}
                        </span>
                      </div>

                      <p className="text-xs text-[#74635c] mb-2">
                        Kapasitas: <strong>{tbl.capacity} Tamu</strong>
                      </p>

                      <div className="mb-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isOccupied
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : isMaintenance
                              ? "bg-neutral-200 text-neutral-700"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOccupied ? "bg-amber-500 animate-pulse" : isMaintenance ? "bg-neutral-500" : "bg-emerald-500"
                            }`}
                          ></span>
                          {isOccupied ? "Terisi (Sedang Digunakan)" : isMaintenance ? "Perawatan / Rusak" : "Kosong (Siap Pakai)"}
                        </span>
                      </div>

                      {/* Active Guest Info if Seated */}
                      {activeSeated && (
                        <div className="p-2.5 rounded-xl bg-amber-100/60 border border-amber-200 text-[11px] text-[#261b17] space-y-0.5 mb-3">
                          <span className="font-bold block text-amber-900">
                            👤 {activeSeated.customerName} ({activeSeated.guestCount} Tamu)
                          </span>
                          <span className="text-[#74635c] block">
                            Kode: <code>{activeSeated.code}</code> · Duduk {new Date(activeSeated.seatedAt || "").toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Table Status Quick Actions */}
                    <div className="pt-3 border-t border-[#f1e6d4] flex flex-wrap gap-1.5 text-xs">
                      {isAvailable && (
                        <button
                          onClick={() => {
                            updateTableStatus(tbl.id, "occupied", selectedStaff);
                            showFeedback(`Meja ${tbl.number} ditandai Terisi (Tamu Walk-in)`);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Tandai Walk-In
                        </button>
                      )}

                      {isOccupied && (
                        <button
                          onClick={() => {
                            if (activeSeated) {
                              handleCompleteDining(activeSeated.code);
                            } else {
                              updateTableStatus(tbl.id, "available", selectedStaff);
                              showFeedback(`Meja ${tbl.number} ditandai Kosong & Tersedia`);
                            }
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Selesai / Kosongkan Meja
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const nextStatus = isMaintenance ? "available" : "maintenance";
                          updateTableStatus(tbl.id, nextStatus as TableStatus, selectedStaff);
                          showFeedback(`Status Meja ${tbl.number} diperbarui.`);
                        }}
                        className="py-1.5 px-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-100 text-[10px] cursor-pointer"
                      >
                        {isMaintenance ? "Buka Meja" : "Maint."}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Menu & Real-time Stock Control */}
        {activeTab === "menu" && (
          <div className="bg-white rounded-2xl border border-[#eadfca] shadow-sm overflow-hidden">
            <div className="p-4 bg-[#fffaf0] border-b border-[#eadfca] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-base text-[#8f1d20]">
                  Kontrol Stok Menu Harian
                </h3>
                <p className="text-xs text-[#74635c]">
                  Klik toggle untuk mengubah status menu habis / tersedia secara instan bagi web customer & AI assistant.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f5f1eb] text-[#74635c] uppercase font-bold text-[10px] tracking-wider border-b border-[#eadfca]">
                  <tr>
                    <th className="p-3.5">Nama Hidangan</th>
                    <th className="p-3.5">Kategori</th>
                    <th className="p-3.5">Harga</th>
                    <th className="p-3.5">Status Ketersediaan</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1e6d4]">
                  {menu.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/70">
                      <td className="p-3.5 font-bold text-[#261b17]">
                        {item.name}
                        {item.isPopular && (
                          <span className="ml-2 text-[10px] text-[#d8a43b] font-normal">★ Favorit</span>
                        )}
                      </td>
                      <td className="p-3.5 text-[#74635c]">{item.category}</td>
                      <td className="p-3.5 font-bold text-[#8f1d20]">{formatPrice(item.price)}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            item.isAvailable
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.isAvailable ? "bg-emerald-500" : "bg-neutral-400"
                            }`}
                          ></span>
                          {item.isAvailable ? "Tersedia" : "Habis Hari Ini"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            const res = toggleMenuAvailability(item.id, selectedStaff);
                            if (res.success && res.item) {
                              showFeedback(
                                `Menu ${res.item.name} diubah menjadi ${
                                  res.item.isAvailable ? "Tersedia" : "Habis"
                                }`
                              );
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            item.isAvailable
                              ? "bg-neutral-100 hover:bg-neutral-200 text-[#74635c]"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          {item.isAvailable ? "Tandai Habis" : "Aktifkan Stok"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Audit Trail */}
        {activeTab === "audit" && (
          <div className="bg-white rounded-2xl border border-[#eadfca] shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-serif font-bold text-base text-[#8f1d20]">
                Log Aktivitas & Audit Trail
              </h3>
              <p className="text-xs text-[#74635c]">
                Semua aksi staf, customer, dan AI Assistant tercatat secara permanen dengan stempel waktu.
              </p>
            </div>

            <div className="divide-y divide-[#f1e6d4]">
              {auditEvents.map((evt) => (
                <div key={evt.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#261b17]">{evt.actor}</span>
                      <span className="px-2 py-0.5 rounded bg-[#261b17]/5 text-[10px] font-mono font-bold text-[#8f1d20]">
                        {evt.action}
                      </span>
                      <span className="text-[#74635c]">{evt.entity}</span>
                    </div>
                    {evt.details && (
                      <p className="text-[#74635c]">{evt.details}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-[#a3948e] shrink-0 font-mono">
                    {new Date(evt.timestamp).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

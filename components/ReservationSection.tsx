"use client";

import { useState, useEffect } from "react";
import { useRestaurant } from "../lib/use-restaurant";
import { TableArea, Reservation } from "../types/restaurant";

interface ReservationSectionProps {
  onOpenTrackModalWithCode?: (code: string) => void;
  initialNote?: string;
}

const DEFAULT_DEPOSIT_AMOUNT = 50000;

export default function ReservationSection({
  onOpenTrackModalWithCode,
  initialNote = "",
}: ReservationSectionProps) {
  const {
    checkAvailability,
    createReservation,
    profile,
    isClient,
  } = useRestaurant();

  const [todayStr, setTodayStr] = useState("2026-08-20");
  const [tomorrowStr, setTomorrowStr] = useState("2026-08-21");
  const [dayAfterStr, setDayAfterStr] = useState("2026-08-22");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: "",
    time: "12:30",
    guests: 2,
    area: "Semua" as TableArea | "Semua",
    notes: "",
    payDepositNow: true,
  });

  // Calculate Dates and load remembered customer profile
  useEffect(() => {
    const now = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const d0 = new Date(now);
    const d1 = new Date(now);
    d1.setDate(d0.getDate() + 1);
    const d2 = new Date(now);
    d2.setDate(d0.getDate() + 2);

    const t0 = formatYMD(d0);
    const t1 = formatYMD(d1);
    const t2 = formatYMD(d2);

    setTodayStr(t0);
    setTomorrowStr(t1);
    setDayAfterStr(t2);

    let savedName = "";
    let savedPhone = "";
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("rm_customer_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          savedName = parsed.name || "";
          savedPhone = parsed.phone || "";
        }
      } catch {
        // ignore
      }
    }

    setFormData((prev) => ({
      ...prev,
      date: prev.date || t0,
      name: prev.name || savedName,
      phone: prev.phone || savedPhone,
    }));
  }, [isClient]);

  // Sync initialNote prop if passed from MenuSection
  useEffect(() => {
    if (initialNote) {
      setFormData((prev) => ({
        ...prev,
        notes: prev.notes ? `${prev.notes} | ${initialNote}` : initialNote,
      }));
    }
  }, [initialNote]);

  const [createdReservation, setCreatedReservation] = useState<Reservation | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");

  // Live availability check — server-side (PostgreSQL + Redis holds), debounced
  const [availability, setAvailability] = useState<{
    available: boolean;
    availableTables: Array<{ id: string; number: string; capacity: number; area: string }>;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    if (!formData.date || !formData.time || !formData.guests) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkAvailability(
        formData.date,
        formData.time,
        Number(formData.guests),
        formData.area === "Semua" ? undefined : (formData.area as TableArea)
      ).then((res) => {
        if (!cancelled) setAvailability(res);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.date, formData.time, formData.guests, formData.area, checkAvailability]);

  /**
   * Helper to ensure the matching Snap script is loaded
   */
  const ensureSnapScript = (snapUrl: string, clientKey: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve();
      const existing = document.getElementById("midtrans-snap") as HTMLScriptElement | null;
      if (existing && existing.src === snapUrl && window.snap) {
        return resolve();
      }
      if (existing) {
        existing.remove();
      }
      const script = document.createElement("script");
      script.id = "midtrans-snap";
      script.src = snapUrl;
      script.setAttribute("data-client-key", clientKey);
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  };

  /**
   * Launch Midtrans Snap Popup
   */
  const triggerMidtransSnap = async (reservation: Reservation, amount: number) => {
    setIsProcessingPayment(true);
    setErrorMessage("");
    try {
      // 1. Request Snap Token from backend API
      const tokenRes = await fetch("/api/payment/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: reservation.code,
          amount: amount,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone,
          notes: reservation.notes,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.success || !tokenData.token) {
        throw new Error(tokenData.message || "Gagal mendapatkan token pembayaran Midtrans.");
      }

      const snapToken = tokenData.token;

      // Ensure exact matching Snap script is loaded (Production vs Sandbox)
      if (tokenData.snapUrl && tokenData.clientKey) {
        await ensureSnapScript(tokenData.snapUrl, tokenData.clientKey);
      }

      // 2. Open Midtrans Snap UI
      if (typeof window !== "undefined" && window.snap) {
        window.snap.pay(snapToken, {
          onSuccess: (result) => {
            console.log("Snap payment success:", result);
            setCreatedReservation((prev) =>
              prev
                ? {
                    ...prev,
                    status: "confirmed",
                    paymentStatus: "settlement",
                    paymentAmount: amount,
                    paymentMethod: result.payment_type || "Midtrans Snap",
                  }
                : null
            );
            setPaymentSuccessMsg("Pembayaran Deposit Berhasil! Meja Anda telah otomatis terkonfirmasi.");
            setIsProcessingPayment(false);
          },
          onPending: (result) => {
            console.log("Snap payment pending:", result);
            setCreatedReservation((prev) =>
              prev
                ? {
                    ...prev,
                    paymentStatus: "pending",
                    paymentAmount: amount,
                    paymentMethod: result.payment_type || "Midtrans Snap",
                  }
                : null
            );
            setIsProcessingPayment(false);
          },
          onError: (result) => {
            console.error("Snap payment error:", result);
            setErrorMessage("Pembayaran gagal atau dibatalkan. Anda dapat mencobanya kembali.");
            setIsProcessingPayment(false);
          },
          onClose: () => {
            setIsProcessingPayment(false);
          },
        });
      } else {
        // Fallback: open redirect URL
        if (tokenData.redirectUrl) {
          window.open(tokenData.redirectUrl, "_blank");
        } else {
          setErrorMessage("Script pembayaran Midtrans belum selesai dimuat. Silakan coba lagi.");
        }
        setIsProcessingPayment(false);
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setErrorMessage(err.message || "Gagal memproses pembayaran Midtrans.");
      setIsProcessingPayment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setPaymentSuccessMsg("");

    const depositAmt = formData.payDepositNow ? DEFAULT_DEPOSIT_AMOUNT : 0;

    const res = await createReservation({
      customerName: formData.name.trim(),
      customerPhone: formData.phone.trim(),
      date: formData.date,
      time: formData.time,
      guestCount: Number(formData.guests),
      preferredArea: formData.area === "Semua" ? undefined : (formData.area as TableArea),
      notes: formData.notes.trim(),
      paymentAmount: depositAmt,
      payDepositNow: formData.payDepositNow,
    });

    if (res.success && res.reservation) {
      setCreatedReservation(res.reservation);

      // Save customer profile & active reservation code to device localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "rm_customer_profile",
            JSON.stringify({ name: formData.name.trim(), phone: formData.phone.trim() })
          );

          const existingRecent = localStorage.getItem("rm_recent_reservations");
          const recentList: string[] = existingRecent ? JSON.parse(existingRecent) : [];
          if (!recentList.includes(res.reservation.code)) {
            recentList.unshift(res.reservation.code);
            localStorage.setItem("rm_recent_reservations", JSON.stringify(recentList.slice(0, 5)));
          }
        } catch {
          // ignore
        }
      }

      // If user opted to pay deposit now, launch Snap immediately
      if (formData.payDepositNow) {
        await triggerMidtransSnap(res.reservation, depositAmt);
      }
    } else {
      setErrorMessage(res.message || "Gagal membuat reservasi. Silakan periksa kembali formulir Anda.");
    }
  };

  const handleCopyCode = () => {
    if (!createdReservation) return;
    navigator.clipboard.writeText(createdReservation.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyWhatsAppSummary = () => {
    if (!createdReservation) return;
    const brandName = profile.name && profile.name !== "..." ? profile.name : "Restoran";
    const text = `*TIKET RESERVASI ${brandName.toUpperCase()}*\n\nKode Tiket: *${createdReservation.code}*\nNama: ${createdReservation.customerName}\nTanggal: ${createdReservation.date}, ${createdReservation.time} WIB\nMeja: ${createdReservation.tableNumber} (${createdReservation.tableArea})\nJumlah Tamu: ${createdReservation.guestCount} Orang\nStatus: Terkonfirmasi Otomatis (Meja Terkunci)\n\nSampai jumpa di ${brandName}!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReset = () => {
    setCreatedReservation(null);
    setFormData((prev) => ({
      ...prev,
      date: todayStr,
      time: "12:30",
      guests: 2,
      area: "Semua",
      notes: "",
      payDepositNow: true,
    }));
    setErrorMessage("");
    setPaymentSuccessMsg("");
  };

  return (
    <section className="reservation py-20 bg-[var(--brand-surface)] border-y border-[var(--brand-border)]" id="reservasi">
      <div className="shell grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Info & Operational Guide */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <p className="eyebrow">Layanan Meja</p>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-[var(--brand-primary)] leading-tight mb-4">
              Reservasi Meja Anda
            </h2>
            <p className="text-[var(--brand-muted)] text-sm md:text-base leading-relaxed">
              Nikmati waktu santap tanpa antre. Sistem kami memastikan meja Anda dipersiapkan dengan baik sebelum kedatangan.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/80 border border-[var(--brand-border)] shadow-sm space-y-4">
            <h4 className="font-serif font-bold text-[var(--brand-ink)] text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-accent)]"></span>
              Ketentuan & Kenyamanan Tamu
            </h4>
            <ul className="text-xs text-[var(--brand-muted)] space-y-3 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-[var(--brand-primary)] font-bold text-sm leading-none">•</span>
                <span>
                  Buka setiap hari: <strong>{profile.openingHours}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[var(--brand-primary)] font-bold text-sm leading-none">•</span>
                <span>
                  Reservasi berstatus <strong>Terkonfirmasi Otomatis</strong> — sistem langsung mengunci slot meja Anda tanpa menunggu verifikasi manual kasir.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[var(--brand-primary)] font-bold text-sm leading-none">•</span>
                <span>
                  Simpan <strong>Kode Reservasi</strong> untuk ditunjukkan kepada staf saat Anda tiba di restoran.
                </span>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-3xl bg-[var(--brand-primary)]/5 border border-[var(--brand-primary)]/15 flex items-center gap-4 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)] text-white flex items-center justify-center text-xl font-bold font-serif shrink-0 shadow-sm">
              ⚡
            </div>
            <div>
              <p className="text-xs text-[var(--brand-primary)] font-bold uppercase tracking-wider">Garansi Bebas Double-Booking</p>
              <p className="text-xs text-[var(--brand-muted)]">
                Sistem mengunci slot meja secara <strong>real-time</strong> untuk menjamin meja Anda tidak akan diberikan ke tamu lain pada jam tersebut.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Form or Success State */}
        <div className="lg:col-span-7">
          {createdReservation ? (
            /* Ticket Confirmation View */
            <div className="bg-white p-8 md:p-10 rounded-3xl border border-[var(--brand-border-strong)] shadow-xl shadow-[var(--brand-primary)]/5 space-y-6">
              <div className="text-center pb-6 border-b border-dashed border-[var(--brand-border-strong)]">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-3xl mb-3 shadow-xs">
                  ✓
                </div>
                <div className="inline-block px-3 py-1 mb-2 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider">
                  ⚡ Auto-Confirmed by System
                </div>
                <h3 className="font-serif text-2xl md:text-3xl font-bold text-[var(--brand-ink)]">
                  Meja Anda Berhasil Dikunci!
                </h3>
                <p className="text-xs md:text-sm text-[var(--brand-muted)] mt-1">
                  Reservasi telah terkonfirmasi otomatis oleh sistem. Meja {createdReservation.tableNumber} siap untuk kehadiran Anda.
                </p>
              </div>

              {/* Ticket Card Box */}
              <div className="bg-[var(--brand-bg)] p-6 rounded-3xl border-2 border-dashed border-[var(--brand-accent)] text-center space-y-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--brand-muted)]">
                  KODE TIKET & E-PASS RESERVASI
                </span>
                <div className="font-serif text-4xl md:text-5xl font-extrabold text-[var(--brand-primary)] tracking-wider">
                  {createdReservation.code}
                </div>

                {/* Live Status & Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Status: Terkonfirmasi Otomatis (Slot Terkunci)
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 text-white text-xs font-mono font-bold">
                    📱 {createdReservation.qrToken || `QR-${createdReservation.code}-VERIFIED`}
                  </span>

                  {createdReservation.paymentStatus === "settlement" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold">
                      💳 Deposit Lunas (Rp {createdReservation.paymentAmount?.toLocaleString("id-ID") || "50.000"})
                    </span>
                  ) : createdReservation.paymentStatus === "pending" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
                      ⏳ Menunggu Pembayaran Midtrans
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
                      🏪 Bayar di Kasir Restoran
                    </span>
                  )}
                </div>

                {paymentSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    ✓ {paymentSuccessMsg}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left pt-4 border-t border-[var(--brand-border)] text-xs">
                  <div>
                    <span className="text-[var(--brand-muted)] block">Nama</span>
                    <strong className="text-[var(--brand-ink)]">{createdReservation.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--brand-muted)] block">Waktu</span>
                    <strong className="text-[var(--brand-ink)]">{createdReservation.date}, {createdReservation.time}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--brand-muted)] block">Kapasitas</span>
                    <strong className="text-[var(--brand-ink)]">{createdReservation.guestCount} Orang</strong>
                  </div>
                  <div>
                    <span className="text-[var(--brand-muted)] block">Meja Ditunjuk</span>
                    <strong className="text-[var(--brand-primary)]">{createdReservation.tableNumber} ({createdReservation.tableArea})</strong>
                  </div>
                </div>
              </div>

              {/* Action buttons if not paid yet */}
              {createdReservation.paymentStatus !== "settlement" && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-accent)]/15 border border-[var(--brand-primary)]/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left text-xs">
                    <p className="font-bold text-[var(--brand-primary)]">Kunci Meja dengan Bayar Deposit</p>
                    <p className="text-[var(--brand-muted)]">Bayar Rp 50.000 via QRIS/VA/E-Wallet agar langsung disetujui otomatis.</p>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessingPayment}
                    onClick={() => triggerMidtransSnap(createdReservation, DEFAULT_DEPOSIT_AMOUNT)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    {isProcessingPayment ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Membuka Midtrans...</span>
                      </>
                    ) : (
                      <>
                        <span>💳 Bayar Sekarang via Midtrans</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex-1 min-w-[140px] py-3 px-4 rounded-xl border border-[var(--brand-border-strong)] text-xs font-bold text-[var(--brand-ink)] hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-[var(--brand-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copied ? "✓ Tersalin!" : "Salin Kode Tiket"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyWhatsAppSummary}
                  className="flex-1 min-w-[160px] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>📲 Bagikan ke WA</span>
                </button>

                {onOpenTrackModalWithCode && (
                  <button
                    type="button"
                    onClick={() => onOpenTrackModalWithCode(createdReservation.code)}
                    className="flex-1 min-w-[160px] py-3 px-4 rounded-xl bg-[var(--brand-ink)] text-white text-xs font-bold hover:bg-[var(--brand-primary)] transition-colors cursor-pointer text-center"
                  >
                    Lacak Status Tiket →
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="py-3 px-4 rounded-xl border border-transparent text-xs font-bold text-[var(--brand-muted)] hover:text-[var(--brand-primary)] transition-colors cursor-pointer"
                >
                  Pesan Meja Lain
                </button>
              </div>
            </div>
          ) : (
            /* Main Reservation Form */
            <form
              onSubmit={handleSubmit}
              className="bg-white p-8 md:p-10 rounded-3xl border border-[var(--brand-border-strong)] shadow-xl shadow-[var(--brand-primary)]/5 space-y-5"
            >
              <div className="border-b border-[var(--brand-border-soft)] pb-4">
                <h3 className="font-serif text-2xl font-bold text-[var(--brand-ink)]">
                  Formulir Pemesanan Meja
                </h3>
                <p className="text-xs text-[var(--brand-muted)] mt-1">
                  Pilih waktu, jumlah tamu, dan preferensi area untuk reservasi instan.
                </p>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <span className="font-bold text-base leading-none">⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1-Tap Date Presets */}
              <div>
                <label className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                  Pilihan Cepat Tanggal
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, date: todayStr })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formData.date === todayStr
                        ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs"
                        : "bg-[var(--brand-bg)] text-[var(--brand-muted)] border-[var(--brand-border-strong)] hover:border-[var(--brand-primary)]"
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, date: tomorrowStr })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formData.date === tomorrowStr
                        ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs"
                        : "bg-[var(--brand-bg)] text-[var(--brand-muted)] border-[var(--brand-border-strong)] hover:border-[var(--brand-primary)]"
                    }`}
                  >
                    Besok
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, date: dayAfterStr })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formData.date === dayAfterStr
                        ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs"
                        : "bg-[var(--brand-bg)] text-[var(--brand-muted)] border-[var(--brand-border-strong)] hover:border-[var(--brand-primary)]"
                    }`}
                  >
                    Lusa
                  </button>
                </div>
              </div>

              {/* 1-Tap Peak Hours Presets */}
              <div>
                <label className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                  Jam Favorit Kedatangan
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { time: "12:00", label: "12:00 (Makan Siang)" },
                    { time: "13:00", label: "13:00" },
                    { time: "18:30", label: "18:30 (Makan Malam)" },
                    { time: "19:30", label: "19:30" },
                  ].map((preset) => (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => setFormData({ ...formData, time: preset.time })}
                      className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
                        formData.time === preset.time
                          ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs"
                          : "bg-white text-[var(--brand-muted)] border-[var(--brand-border-strong)] hover:border-[var(--brand-primary)]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reservation-name" className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                    Nama Pemesan <span className="text-[var(--brand-primary)]">*</span>
                  </label>
                  <input
                    id="reservation-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Contoh: Sdr. Budi Setiawan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--brand-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="reservation-phone" className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                    Nomor WhatsApp <span className="text-[var(--brand-muted)] font-normal text-[11px]">(Opsional)</span>
                  </label>
                  <input
                    id="reservation-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Contoh: 081298765432"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--brand-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition-all"
                  />
                </div>
              </div>

              {/* Custom Date, Custom Time, Guests */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="reservation-date" className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                    Pilih Tanggal Lain
                  </label>
                  <input
                    id="reservation-date"
                    name="date"
                    type="date"
                    required
                    min={todayStr}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--brand-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition-all bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="reservation-time" className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                    Pilih Jam Lain
                  </label>
                  <input
                    id="reservation-time"
                    name="time"
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--brand-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition-all bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="reservation-guests" className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                    Jumlah Tamu <span className="text-[var(--brand-primary)]">*</span>
                  </label>
                  <select
                    id="reservation-guests"
                    name="guests"
                    value={formData.guests}
                    onChange={(e) => setFormData({ ...formData, guests: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--brand-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition-all bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} Orang {n >= 8 ? "(VIP Room)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preferred Area */}
              <div>
                <label className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                  Preferensi Area Meja
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["Semua", "Indoor", "Outdoor", "VIP"] as Array<TableArea | "Semua">).map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setFormData({ ...formData, area: ar })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        formData.area === ar
                          ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs"
                          : "bg-white text-[var(--brand-muted)] border-[var(--brand-border-strong)] hover:border-[var(--brand-primary)]/50"
                      }`}
                    >
                      {ar === "Semua" ? "Bebas / Rekomendasi" : ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Availability Feedback Badge */}
              {availability && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 transition-all shadow-2xs ${
                    availability.available
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <span className="font-bold text-sm">
                    {availability.available ? "✓" : "!"}
                  </span>
                  <div>
                    <span className="font-bold block">
                      {availability.available
                        ? `Ketersediaan Terkonfirmasi (${availability.availableTables.length} Meja Siap Dipilih)`
                        : "Meja Penuh di Jam Ini"}
                    </span>
                    <span className="opacity-90">
                      {availability.available
                        ? `Meja ${availability.availableTables.map((t) => `${t.number} (${t.area})`).join(", ")} tersedia untuk jadwal ini.`
                        : availability.reason}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Method / Deposit Selection */}
              <div className="pt-2 border-t border-[var(--brand-border-soft)] space-y-2">
                <p className="text-xs font-bold text-[var(--brand-ink)]">
                  Opsi Pembayaran & Konfirmasi:
                </p>
                <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-[var(--brand-accent)] ${
                      formData.payDepositNow
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-xs"
                        : "border-[var(--brand-border-strong)] bg-white hover:border-[var(--brand-primary)]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={formData.payDepositNow}
                      onChange={() => setFormData({ ...formData, payDepositNow: true })}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[var(--brand-primary)] flex items-center gap-1.5">
                        <span>💳</span> Bayar Deposit (Rp 50.000)
                      </span>
                      {formData.payDepositNow && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-primary)]"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--brand-muted)] leading-relaxed">
                      <strong>Konfirmasi Instan</strong> via Midtrans Snap (QRIS, GoPay, ShopeePay, Virtual Account).
                    </p>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-[var(--brand-accent)] ${
                      !formData.payDepositNow
                        ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 shadow-xs"
                        : "border-[var(--brand-border-strong)] bg-white hover:border-[var(--brand-primary)]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={!formData.payDepositNow}
                      onChange={() => setFormData({ ...formData, payDepositNow: false })}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[var(--brand-ink)] flex items-center gap-1.5">
                        <span>🏢</span> Bayar di Restoran
                      </span>
                      {!formData.payDepositNow && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-primary)]"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--brand-muted)] leading-relaxed">
                      Meja <strong>Terkunci Otomatis</strong>. Pembayaran dilakukan langsung saat bersantap di restoran.
                    </p>
                  </label>
                </fieldset>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="reservation-notes" className="block text-xs font-bold text-[var(--brand-ink)] mb-1.5">
                  Catatan Tambahan & Permintaan Khusus (Opsional)
                </label>
                <textarea
                  id="reservation-notes"
                  name="notes"
                  rows={2}
                  placeholder="Misal: Request sambal ijo lebih, sediakan baby chair, ingin pesan Rendang & Ayam Pop, dll."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--brand-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={(availability ? !availability.available : false) || isProcessingPayment}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                  availability && !availability.available
                    ? "bg-neutral-400 cursor-not-allowed opacity-70"
                    : "bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] shadow-[var(--brand-primary)]/25 cursor-pointer hover:scale-[1.01]"
                }`}
              >
                {isProcessingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menghubungkan ke Midtrans Snap...</span>
                  </>
                ) : formData.payDepositNow ? (
                  <>
                    <span>Lanjut ke Pembayaran Midtrans (Rp 50.000)</span>
                    <span>→</span>
                  </>
                ) : (
                  <>
                    <span>Kunci Meja & Buat Reservasi Sekarang</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

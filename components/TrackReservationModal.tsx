"use client";

import { useState, useEffect, useCallback } from "react";
import { Reservation, TableArea } from "../types/restaurant";
import { useTenant } from "../lib/tenant-context";
import {
  lookupReservationRemote,
  manageReservationRemote,
} from "../lib/api-client";

interface TrackReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

const RECENT_KEY = "***";

export default function TrackReservationModal({
  isOpen,
  onClose,
  initialCode = "",
}: TrackReservationModalProps) {
  const { branding } = useTenant();
  const brandName = branding ? branding.chatPersonaLabel.replace("Asisten AI ", "") : "Restoran";

  const [codeQuery, setCodeQuery] = useState(initialCode);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [manageToken, setManageToken] = useState<string>("");
  const [searched, setSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Server-side phone verification state
  const [requiresPhone, setRequiresPhone] = useState(false);
  const [phoneHint, setPhoneHint] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const [activeAction, setActiveAction] = useState<"view" | "reschedule" | "cancel">("view");
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [rescheduleData, setRescheduleData] = useState({
    date: "",
    time: "12:30",
    guests: 2,
    area: "Indoor" as TableArea,
    notes: "",
  });

  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const normalizeCode = (raw: string) => {
    let clean = raw.trim().replace(/\s+/g, "").toUpperCase();
    if (/^[A-Z]{2}\d+$/.test(clean)) {
      clean = `${clean.slice(0, 2)}-${clean.slice(2)}`;
    }
    return clean;
  };

  const applyReservation = useCallback((res: Reservation) => {
    setReservation(res);
    setRescheduleData({
      date: res.date,
      time: res.time,
      guests: res.guestCount,
      area: res.tableArea,
      notes: res.notes || "",
    });
  }, []);

  /**
   * Two-phase lookup: first attempt without phone; if the server says the code
   * is protected by a registered phone, prompt for the last-4 digits and retry.
   */
  const runLookup = useCallback(
    async (codeRaw: string, hint?: string) => {
      const norm = normalizeCode(codeRaw);
      if (!norm) return;
      setCodeQuery(norm);
      setIsLoading(true);
      setActionMessage("");
      setActionError("");
      setVerifyError("");
      try {
        const result = await lookupReservationRemote(norm, hint);
        setReservation(result.data);
        setManageToken(result.manageToken);
        applyReservation(result.data);
        setRequiresPhone(false);
        setSearched(true);
        setActiveAction("view");
        // remember code on device
        try {
          const stored = localStorage.getItem(RECENT_KEY);
          const list: string[] = stored ? JSON.parse(stored) : [];
          if (!list.includes(norm)) {
            list.unshift(norm);
            localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
            setRecentCodes(list.slice(0, 5));
          }
        } catch {
          // ignore
        }
      } catch (err: any) {
        if (err?.requiresPhone) {
          setReservation(null);
          setRequiresPhone(true);
          setVerifyError(hint ? err.message || "4 digit terakhir tidak cocok." : "");
          setSearched(true);
        } else {
          setReservation(null);
          setManageToken("");
          setRequiresPhone(false);
          setActionError(err?.message || "Gagal mencari tiket.");
          setSearched(true);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [applyReservation]
  );

  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecentCodes(JSON.parse(stored));
    } catch {
      setRecentCodes([]);
    }

    setActionMessage("");
    setActionError("");
    setVerifyError("");
    setRequiresPhone(false);
    setActiveAction("view");

    if (initialCode) {
      void runLookup(initialCode);
    } else {
      setCodeQuery("");
      setReservation(null);
      setManageToken("");
      setSearched(false);
    }
  }, [initialCode, isOpen, runLookup]);

  if (!isOpen) return null;

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (requiresPhone) {
      void runLookup(codeQuery, phoneHint);
    } else {
      void runLookup(codeQuery);
    }
  };

  const handleShareToWhatsApp = () => {
    if (!reservation) return;
    const text = `*TIKET RESERVASI ${brandName.toUpperCase()}*\n\nKode Tiket: *${reservation.code}*\nNama: ${reservation.customerName}\nTanggal: ${reservation.date}, ${reservation.time} WIB\nMeja: ${reservation.tableNumber} (${reservation.tableArea})\nJumlah Tamu: ${reservation.guestCount} Orang\nStatus: ${reservation.status}\n\nSampai jumpa di ${brandName}!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopySummary = () => {
    if (!reservation) return;
    const text = `TIKET RESERVASI ${brandName.toUpperCase()}\nKode Tiket: ${reservation.code}\nNama: ${reservation.customerName}\nTanggal: ${reservation.date}, ${reservation.time} WIB\nMeja: ${reservation.tableNumber} (${reservation.tableArea})\nJumlah Tamu: ${reservation.guestCount} Orang\nStatus: ${reservation.status}`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleCancelReservation = async () => {
    if (!reservation) return;
    setActionError("");
    setActionMessage("");
    try {
      const res = await manageReservationRemote({
        code: reservation.code,
        manageToken,
        action: "cancel",
        reason: cancelReason.trim() || undefined,
      });
      if (res.success) {
        if (res.reservation) applyReservation(res.reservation);
        else setReservation({ ...reservation, status: "cancelled" });
        setActiveAction("view");
        setActionMessage(res.message || "Reservasi Anda berhasil dibatalkan.");
      } else {
        setActionError(res.message || "Gagal membatalkan reservasi.");
      }
    } catch (err: any) {
      setActionError(err?.message || "Gagal membatalkan reservasi.");
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    setActionError("");
    setActionMessage("");
    try {
      const res = await manageReservationRemote({
        code: reservation.code,
        manageToken,
        action: "reschedule",
        date: rescheduleData.date,
        time: rescheduleData.time,
        guestCount: Number(rescheduleData.guests),
      });
      if (res.success) {
        if (res.reservation) applyReservation(res.reservation);
        setActiveAction("view");
        setActionMessage(res.message || "Jadwal reservasi berhasil diperbarui!");
      } else {
        setActionError(res.message || "Gagal mengubah jadwal.");
      }
    } catch (err: any) {
      setActionError(err?.message || "Gagal mengubah jadwal.");
    }
  };

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

  const triggerMidtransSnap = async (amount: number = 50000) => {
    if (!reservation) return;
    setIsProcessingPayment(true);
    setActionError("");
    setActionMessage("");
    try {
      const tokenRes = await fetch("/api/payment/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: reservation.code,
          amount,
          customerName: reservation.customerName,
          notes: reservation.notes,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.success || !tokenData.token) {
        throw new Error(tokenData.message || "Gagal membuat token pembayaran.");
      }
      const snapToken = tokenData.token;
      if (tokenData.snapUrl && tokenData.clientKey) {
        await ensureSnapScript(tokenData.snapUrl, tokenData.clientKey);
      }
      if (typeof window !== "undefined" && window.snap) {
        window.snap.pay(snapToken, {
          onSuccess: () => {
            setActionMessage("Pembayaran Deposit Berhasil! Reservasi Anda otomatis berstatus Terkonfirmasi.");
            setIsProcessingPayment(false);
          },
          onPending: () => {
            setActionMessage("Instruksi pembayaran diterbitkan. Menunggu penyelesaian transfer Anda.");
            setIsProcessingPayment(false);
          },
          onError: () => {
            setActionError("Pembayaran gagal atau dibatalkan.");
            setIsProcessingPayment(false);
          },
          onClose: () => setIsProcessingPayment(false),
        });
      } else if (tokenData.redirectUrl) {
        window.open(tokenData.redirectUrl, "_blank");
        setIsProcessingPayment(false);
      } else {
        setActionError("Script pembayaran Midtrans belum selesai dimuat.");
        setIsProcessingPayment(false);
      }
    } catch (err: any) {
      setActionError(err.message || "Gagal memproses pembayaran Midtrans.");
      setIsProcessingPayment(false);
    }
  };

  const statusBadge = (status: Reservation["status"]) => {
    const map: Record<string, { label: string; cls: string; dot: string }> = {
      confirmed: { label: "Terkonfirmasi Otomatis", cls: "bg-emerald-50 text-emerald-800 border-emerald-300", dot: "bg-emerald-500" },
      seated: { label: "Sedang Makan (Seated)", cls: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-600 animate-pulse" },
      completed: { label: "Selesai Bersantap", cls: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-500" },
      pending: { label: "Menunggu Pembayaran", cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500 animate-pulse" },
      no_show: { label: "Tidak Hadir (No-Show)", cls: "bg-rose-50 text-rose-800 border-rose-200", dot: "bg-rose-400" },
      expired: { label: "Kadaluarsa (Expired)", cls: "bg-neutral-100 text-neutral-600 border-neutral-200", dot: "bg-neutral-400" },
      rejected: { label: "Ditolak", cls: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-500" },
      cancelled: { label: "Dibatalkan", cls: "bg-neutral-100 text-neutral-600 border-neutral-200", dot: "bg-neutral-400" },
    };
    const s = map[status] || map.cancelled;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold shadow-sm ${s.cls}`}>
        <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
        {s.label}
      </span>
    );
  };

  const paymentBadge = (paymentStatus?: string) => {
    switch (paymentStatus) {
      case "settlement":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold">💳 Deposit Lunas</span>;
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold">⏳ Menunggu Pembayaran</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 text-[11px] font-bold">🏪 Bayar di Restoran</span>;
    }
  };

  const primary = branding?.theme.primary || "#8f1d20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#d8cbbb] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90dvh]" role="dialog" aria-modal="true" aria-labelledby="track-reservation-title">
        {/* Header */}
        <div className="p-6 border-b border-[#f1e6d4] flex items-center justify-between" style={{ background: branding?.theme.bg || "#fffaf0" }}>
          <div>
            <h3 id="track-reservation-title" className="font-serif text-xl font-bold" style={{ color: primary }}>
              Lacak & Kelola Reservasi
            </h3>
            <p className="text-xs text-[#74635c]">
              Masukkan kode reservasi unik Anda (contoh: <code>{branding?.codePrefix || "RM"}-1001</code>)
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup pelacakan reservasi"
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-[#74635c] text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {recentCodes.length > 0 && !requiresPhone && (
            <div>
              <span className="block text-[11px] font-bold text-[#74635c] mb-1.5">Tiket Terbaru di Perangkat Ini:</span>
              <div className="flex flex-wrap gap-1.5">
                {recentCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => void runLookup(code)}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all cursor-pointer ${
                      codeQuery === code ? "text-white border-transparent shadow-xs" : "bg-[#fffaf0] border-[#d8a43b]/40"
                    }`}
                    style={codeQuery === code ? { background: primary } : { color: primary }}
                  >
                    🎟️ {code}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              aria-label="Kode reservasi"
              placeholder={`Kode Tiket (misal: ${branding?.codePrefix || "RM"}-1001)`}
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#d8cbbb] text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-[#d8a43b]"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs disabled:opacity-60"
              style={{ background: primary }}
            >
              {isLoading ? "..." : "Cari Tiket"}
            </button>
          </form>

          {/* Server-side phone verification gate */}
          {requiresPhone && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <p className="text-xs font-bold text-amber-900">🔒 Verifikasi Keamanan Diperlukan</p>
              <p className="text-[11px] text-amber-800">
                Masukkan 4 digit terakhir nomor WhatsApp yang dipakai saat booking untuk melihat tiket ini.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="Misal: 5432"
                value={phoneHint}
                onChange={(e) => setPhoneHint(e.target.value.replace(/\D/g, ""))}
                className="w-full p-2 bg-white rounded-lg border border-amber-300 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {verifyError && <p className="text-[11px] text-red-600 font-semibold">{verifyError}</p>}
              <button
                type="button"
                onClick={() => void runLookup(codeQuery, phoneHint)}
                className="w-full py-2 rounded-lg text-white text-xs font-bold cursor-pointer"
                style={{ background: primary }}
              >
                Verifikasi & Lihat Tiket
              </button>
            </div>
          )}

          {actionMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">✓ {actionMessage}</div>
          )}
          {actionError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">⚠️ {actionError}</div>
          )}

          {searched && reservation && (
            <div className="bg-[#fffaf0] p-5 rounded-3xl border border-[#eadfca] space-y-4 shadow-xs" style={{ background: branding?.theme.bg || "#fffaf0" }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-serif text-2xl font-bold block" style={{ color: primary }}>{reservation.code}</span>
                  <div className="pt-0.5">{paymentBadge(reservation.paymentStatus)}</div>
                </div>
                {statusBadge(reservation.status)}
              </div>

              {activeAction === "view" && (
                <>
                  {(reservation.status === "pending" || reservation.status === "confirmed" || reservation.status === "seated" || reservation.status === "completed") && (
                    <div className="py-2.5 px-3 bg-white rounded-2xl border border-[#eadfca]/80 my-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <div className="flex items-center gap-1" style={{ color: primary }}>
                          <span className="w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center" style={{ background: primary }}>1</span>
                          <span>Terkonfirmasi</span>
                        </div>
                        <span className="text-neutral-300">→</span>
                        <div className={`flex items-center gap-1 ${reservation.status === "seated" || reservation.status === "completed" ? "" : "text-neutral-400"}`} style={reservation.status === "seated" || reservation.status === "completed" ? { color: primary } : undefined}>
                          <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center ${reservation.status === "seated" || reservation.status === "completed" ? "" : "bg-neutral-300"}`} style={reservation.status === "seated" || reservation.status === "completed" ? { background: primary } : undefined}>2</span>
                          <span>Duduk (Seated)</span>
                        </div>
                        <span className="text-neutral-300">→</span>
                        <div className={`flex items-center gap-1 ${reservation.status === "completed" ? "text-emerald-700" : "text-neutral-400"}`}>
                          <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center ${reservation.status === "completed" ? "bg-emerald-600" : "bg-neutral-300"}`}>3</span>
                          <span>Selesai</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#eadfca]">
                    <div>
                      <span className="text-[#74635c] block">Nama Pemesan</span>
                      <strong className="text-[#261b17]">{reservation.customerName}</strong>
                    </div>
                    <div>
                      <span className="text-[#74635c] block">Kontak</span>
                      <strong className="text-[#261b17]">{reservation.customerPhone || "Tidak dicantumkan"}</strong>
                    </div>
                    <div>
                      <span className="text-[#74635c] block">Tanggal & Jam</span>
                      <strong className="text-[#261b17]">{reservation.date} · {reservation.time} WIB</strong>
                    </div>
                    <div>
                      <span className="text-[#74635c] block">Meja Ditunjuk</span>
                      <strong style={{ color: primary }}>Meja {reservation.tableNumber} ({reservation.tableArea})</strong>
                    </div>
                    <div>
                      <span className="text-[#74635c] block">Jumlah Tamu</span>
                      <strong className="text-[#261b17]">{reservation.guestCount} Orang</strong>
                    </div>
                    <div>
                      <span className="text-[#74635c] block">Status Bayar</span>
                      <strong className="text-[#261b17]">
                        {reservation.paymentStatus === "settlement"
                          ? `Lunas (Rp ${reservation.paymentAmount?.toLocaleString("id-ID") || "50.000"})`
                          : reservation.paymentStatus === "pending"
                          ? "Menunggu Pembayaran"
                          : "Belum Dibayar (Bayar di Kasir)"}
                      </strong>
                    </div>
                  </div>

                  {reservation.notes && (
                    <div className="text-xs bg-white p-3 rounded-xl border border-[#eadfca]">
                      <span className="text-[#74635c] block font-bold mb-0.5">Catatan:</span>
                      <span className="text-[#261b17]">{reservation.notes}</span>
                    </div>
                  )}

                  {reservation.rejectionReason && (
                    <div className="text-xs bg-red-50 p-3 rounded-xl border border-red-200 text-red-800">
                      <span className="font-bold block mb-0.5">Alasan Penolakan:</span>
                      <span>{reservation.rejectionReason}</span>
                    </div>
                  )}

                  {reservation.paymentStatus !== "settlement" && reservation.status !== "cancelled" && reservation.status !== "rejected" && (
                    <div className="p-3 bg-white rounded-xl border border-[#d8a43b]/60 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-[#74635c]">
                        <span className="font-bold block" style={{ color: primary }}>Bayar Deposit (Rp 50.000)</span>
                        <span>Kunci meja & langsung konfirmasi via Midtrans.</span>
                      </div>
                      <button
                        type="button"
                        disabled={isProcessingPayment}
                        onClick={() => triggerMidtransSnap(50000)}
                        className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                        style={{ background: primary }}
                      >
                        {isProcessingPayment ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span>Bayar Sekarang →</span>}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={handleShareToWhatsApp} className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                      <span>📲 Bagikan ke WA</span>
                    </button>
                    <button type="button" onClick={handleCopySummary} className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-white border border-[#d8cbbb] text-[#261b17] hover:bg-neutral-50 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                      <span>{copiedSummary ? "✓ Tersalin!" : "📋 Salin Ringkasan"}</span>
                    </button>
                  </div>

                  {(reservation.status === "pending" || reservation.status === "confirmed") && (
                    <div className="flex gap-2 pt-2 border-t border-[#eadfca]">
                      <button
                        type="button"
                        onClick={() => { setActiveAction("reschedule"); setVerifyError(""); }}
                        className="flex-1 py-2 px-3 rounded-xl bg-white border text-xs font-bold transition-all cursor-pointer shadow-xs"
                        style={{ borderColor: "#d8a43b", color: primary }}
                      >
                        📅 Ubah Jadwal (Reschedule)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveAction("cancel"); setVerifyError(""); }}
                        className="py-2 px-3 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Batalkan
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeAction === "reschedule" && (
                <form onSubmit={handleRescheduleSubmit} className="space-y-3 pt-2 border-t border-[#eadfca]">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif font-bold text-sm" style={{ color: primary }}>Form Ubah Jadwal</h4>
                    <button type="button" onClick={() => setActiveAction("view")} className="text-xs text-[#74635c] hover:underline">← Kembali</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[#74635c] font-bold mb-1">Tanggal Baru</label>
                      <input type="date" required value={rescheduleData.date} onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })} className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]" />
                    </div>
                    <div>
                      <label className="block text-[#74635c] font-bold mb-1">Jam Baru</label>
                      <input type="time" required value={rescheduleData.time} onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })} className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[#74635c] font-bold mb-1">Jumlah Tamu</label>
                      <select value={rescheduleData.guests} onChange={(e) => setRescheduleData({ ...rescheduleData, guests: Number(e.target.value) })} className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]">
                        {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (<option key={n} value={n}>{n} Orang</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#74635c] font-bold mb-1">Area</label>
                      <select value={rescheduleData.area} onChange={(e) => setRescheduleData({ ...rescheduleData, area: e.target.value as TableArea })} className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]">
                        <option value="Indoor">Indoor (AC)</option>
                        <option value="Outdoor">Outdoor</option>
                        <option value="VIP">VIP Room</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                    ✓ Identitas sudah terverifikasi via nomor WhatsApp. Ketersediaan meja baru dicek otomatis oleh server.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 py-2 px-3 rounded-xl text-white text-xs font-bold cursor-pointer" style={{ background: primary }}>Simpan Jadwal Baru</button>
                    <button type="button" onClick={() => setActiveAction("view")} className="py-2 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-600 cursor-pointer">Batal</button>
                  </div>
                </form>
              )}

              {activeAction === "cancel" && (
                <div className="p-4 bg-red-50/70 rounded-xl border border-red-200 space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-red-800">Konfirmasi Pembatalan Reservasi</p>
                    <button type="button" onClick={() => setActiveAction("view")} className="text-xs text-neutral-500 hover:underline">← Kembali</button>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#74635c] mb-1">Alasan pembatalan (opsional):</label>
                    <input type="text" placeholder="Misal: Ada keperluan mendadak..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-red-200 focus:outline-none" />
                  </div>
                  <p className="text-[11px] text-emerald-700">✓ Identitas sudah terverifikasi via nomor WhatsApp.</p>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={handleCancelReservation} className="flex-1 py-1.5 px-3 rounded-lg bg-red-700 text-white text-xs font-bold hover:bg-red-800 cursor-pointer">Ya, Batalkan Sekarang</button>
                    <button type="button" onClick={() => setActiveAction("view")} className="py-1.5 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-neutral-600 hover:bg-neutral-50 cursor-pointer">Kembali</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {searched && !reservation && !requiresPhone && !actionError && (
            <div className="p-6 rounded-2xl bg-neutral-50 border border-dashed border-neutral-300 text-center space-y-2">
              <p className="text-sm font-bold text-[#261b17]">Tiket &quot;{codeQuery}&quot; Tidak Ditemukan</p>
              <p className="text-xs text-[#74635c]">Pastikan format kode benar (contoh: <code>{branding?.codePrefix || "RM"}-1001</code>).</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#f1e6d4] bg-neutral-50 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-[#74635c] hover:bg-neutral-200 transition-colors cursor-pointer">Tutup</button>
        </div>
      </div>
    </div>
  );
}

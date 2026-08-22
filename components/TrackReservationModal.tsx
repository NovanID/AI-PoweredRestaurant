"use client";

import { useState, useEffect } from "react";
import { useRestaurant } from "../lib/use-restaurant";
import { Reservation, TableArea } from "../types/restaurant";

interface TrackReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export default function TrackReservationModal({
  isOpen,
  onClose,
  initialCode = "",
}: TrackReservationModalProps) {
  const {
    getReservationByCode,
    updateReservationStatus,
    updateReservation,
    updatePaymentStatus,
    setReservationSnapToken,
  } = useRestaurant();
  const [codeQuery, setCodeQuery] = useState(initialCode);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [searched, setSearched] = useState(false);
  const [activeAction, setActiveAction] = useState<"view" | "reschedule" | "cancel">("view");

  // Phone verification for actions
  const [phoneVerify, setPhoneVerify] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Reschedule form state
  const [rescheduleData, setRescheduleData] = useState({
    date: "",
    time: "12:30",
    guests: 2,
    area: "Indoor" as TableArea,
    notes: "",
  });

  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (initialCode) {
      setCodeQuery(initialCode);
      const res = getReservationByCode(initialCode);
      setReservation(res || null);
      if (res) {
        setRescheduleData({
          date: res.date,
          time: res.time,
          guests: res.guestCount,
          area: res.tableArea,
          notes: res.notes || "",
        });
      }
      setSearched(true);
    } else {
      setCodeQuery("");
      setReservation(null);
      setSearched(false);
    }

    setActiveAction("view");
    setActionMessage("");
    setActionError("");
    setVerifyError("");
  }, [initialCode, isOpen, getReservationByCode]);

  if (!isOpen) return null;

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActionMessage("");
    setActionError("");
    setActiveAction("view");
    setVerifyError("");
    if (!codeQuery.trim()) return;

    const res = getReservationByCode(codeQuery.trim());
    setReservation(res || null);
    if (res) {
      setRescheduleData({
        date: res.date,
        time: res.time,
        guests: res.guestCount,
        area: res.tableArea,
        notes: res.notes || "",
      });
    }
    setSearched(true);
  };

  const isPhoneValid = () => {
    if (!reservation) return false;
    const cleanInput = phoneVerify.trim().replace(/\D/g, "");
    const cleanPhone = reservation.customerPhone.replace(/\D/g, "");
    if (cleanInput.length < 4) return false;
    return cleanPhone.endsWith(cleanInput) || cleanPhone === cleanInput;
  };

  const handleCancelReservation = () => {
    if (!reservation) return;
    setVerifyError("");
    if (!isPhoneValid()) {
      setVerifyError("Verifikasi gagal: Masukkan 4 digit terakhir nomor WhatsApp terdaftar.");
      return;
    }

    const res = updateReservationStatus(
      reservation.code,
      "cancelled",
      `Customer (${reservation.customerName})`,
      cancelReason.trim() || "Dibatalkan mandiri oleh customer"
    );

    if (res.success && res.reservation) {
      setReservation(res.reservation);
      setActiveAction("view");
      setActionMessage("Reservasi Anda berhasil dibatalkan.");
      setPhoneVerify("");
    } else {
      setActionError(res.message);
    }
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    setVerifyError("");
    setActionError("");

    if (!isPhoneValid()) {
      setVerifyError("Verifikasi gagal: Masukkan 4 digit terakhir nomor WhatsApp terdaftar.");
      return;
    }

    const res = updateReservation(
      reservation.code,
      {
        date: rescheduleData.date,
        time: rescheduleData.time,
        guestCount: Number(rescheduleData.guests),
        preferredArea: rescheduleData.area,
        notes: rescheduleData.notes,
      },
      `Customer (${reservation.customerName})`
    );

    if (res.success && res.reservation) {
      setReservation(res.reservation);
      setActiveAction("view");
      setActionMessage("Jadwal reservasi berhasil diperbarui! Menunggu konfirmasi ulang staf.");
      setPhoneVerify("");
    } else {
      setActionError(res.message);
    }
  };

  /**
   * Helper to ensure matching Snap script is loaded
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
   * Launch Midtrans Snap for unpaid/pending reservations
   */
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
          amount: amount,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone,
          notes: reservation.notes,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.success || !tokenData.token) {
        throw new Error(tokenData.message || "Gagal membuat token pembayaran.");
      }

      const snapToken = tokenData.token;
      setReservationSnapToken(reservation.code, snapToken);

      // Ensure matching script is loaded
      if (tokenData.snapUrl && tokenData.clientKey) {
        await ensureSnapScript(tokenData.snapUrl, tokenData.clientKey);
      }

      if (typeof window !== "undefined" && window.snap) {
        window.snap.pay(snapToken, {
          onSuccess: (result) => {
            console.log("Snap success:", result);
            const res = updatePaymentStatus(
              reservation.code,
              "settlement",
              result.payment_type || "Midtrans Snap",
              amount,
              "Customer Modal Snap"
            );
            if (res.reservation) setReservation(res.reservation);
            setActionMessage("Pembayaran Deposit Berhasil! Reservasi Anda otomatis berstatus Terkonfirmasi.");
            setIsProcessingPayment(false);
          },
          onPending: (result) => {
            console.log("Snap pending:", result);
            const res = updatePaymentStatus(
              reservation.code,
              "pending",
              result.payment_type || "Midtrans Snap",
              amount,
              "Customer Modal Snap"
            );
            if (res.reservation) setReservation(res.reservation);
            setActionMessage("Instruksi pembayaran diterbitkan. Menunggu penyelesaian transfer Anda.");
            setIsProcessingPayment(false);
          },
          onError: (result) => {
            console.error("Snap error:", result);
            setActionError("Pembayaran gagal atau dibatalkan.");
            setIsProcessingPayment(false);
          },
          onClose: () => {
            setIsProcessingPayment(false);
          },
        });
      } else {
        if (tokenData.redirectUrl) {
          window.open(tokenData.redirectUrl, "_blank");
        } else {
          setActionError("Script pembayaran Midtrans belum selesai dimuat.");
        }
        setIsProcessingPayment(false);
      }
    } catch (err: any) {
      console.error("Payment error in modal:", err);
      setActionError(err.message || "Gagal memproses pembayaran Midtrans.");
      setIsProcessingPayment(false);
    }
  };

  const statusBadge = (status: Reservation["status"]) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Terkonfirmasi Otomatis
          </span>
        );
      case "seated":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
            Sedang Makan (Seated)
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Selesai Bersantap
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Menunggu Pembayaran
          </span>
        );
      case "no_show":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Tidak Hadir (No-Show)
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
            Kadaluarsa (Expired)
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Ditolak
          </span>
        );
      case "cancelled":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
            Dibatalkan
          </span>
        );
    }
  };

  const paymentBadge = (paymentStatus?: string) => {
    switch (paymentStatus) {
      case "settlement":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold">
            💳 Deposit Lunas
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold">
            ⏳ Menunggu Pembayaran
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 text-[11px] font-bold">
            🏪 Bayar di Restoran
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#d8cbbb] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#f1e6d4] flex items-center justify-between bg-[#fffaf0]">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#8f1d20]">
              Lacak & Kelola Reservasi
            </h3>
            <p className="text-xs text-[#74635c]">
              Masukkan kode reservasi unik Anda (contoh: <code>RM-1001</code>)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-[#74635c] text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Kode Tiket (e.g. RM-1001)"
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#d8cbbb] text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-[#d8a43b]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#8f1d20] text-white text-xs font-bold hover:bg-[#731518] transition-colors cursor-pointer"
            >
              Cari Tiket
            </button>
          </form>

          {actionMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              ✓ {actionMessage}
            </div>
          )}

          {actionError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              ⚠️ {actionError}
            </div>
          )}

          {/* Search Result */}
          {searched && (
            <div>
              {reservation ? (
                <div className="bg-[#fffaf0] p-5 rounded-2xl border border-[#eadfca] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-serif text-2xl font-bold text-[#8f1d20] block">
                        {reservation.code}
                      </span>
                      <div className="pt-0.5">
                        {paymentBadge(reservation.paymentStatus)}
                      </div>
                    </div>
                    {statusBadge(reservation.status)}
                  </div>

                  {/* Mode: Default View */}
                  {activeAction === "view" && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#eadfca]">
                        <div>
                          <span className="text-[#74635c] block">Nama Pemesan</span>
                          <strong className="text-[#261b17]">{reservation.customerName}</strong>
                        </div>
                        <div>
                          <span className="text-[#74635c] block">Kontak</span>
                          <strong className="text-[#261b17]">
                            {reservation.customerPhone.slice(0, 4)}****{reservation.customerPhone.slice(-4)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#74635c] block">Tanggal & Jam</span>
                          <strong className="text-[#261b17]">
                            {reservation.date} · {reservation.time} WIB
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#74635c] block">Meja Ditunjuk</span>
                          <strong className="text-[#8f1d20]">
                            Meja {reservation.tableNumber} ({reservation.tableArea})
                          </strong>
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

                      {/* Pay Deposit Button if unpaid/pending */}
                      {reservation.paymentStatus !== "settlement" &&
                        reservation.status !== "cancelled" &&
                        reservation.status !== "rejected" && (
                          <div className="p-3 bg-white rounded-xl border border-[#d8a43b]/60 flex items-center justify-between gap-2">
                            <div className="text-[11px] text-[#74635c]">
                              <span className="font-bold text-[#8f1d20] block">Bayar Deposit (Rp 50.000)</span>
                              <span>Kunci meja & langsung konfirmasi via Midtrans.</span>
                            </div>
                            <button
                              type="button"
                              disabled={isProcessingPayment}
                              onClick={() => triggerMidtransSnap(50000)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#8f1d20] hover:bg-[#731518] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                            >
                              {isProcessingPayment ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <span>Bayar Sekarang →</span>
                              )}
                            </button>
                          </div>
                        )}

                      {/* Action Buttons */}
                      {(reservation.status === "pending" || reservation.status === "confirmed") && (
                        <div className="flex gap-2 pt-2 border-t border-[#eadfca]">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAction("reschedule");
                              setVerifyError("");
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-white border border-[#d8a43b] text-[#8f1d20] hover:bg-[#8f1d20] hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            📅 Ubah Jadwal (Reschedule)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAction("cancel");
                              setVerifyError("");
                            }}
                            className="py-2 px-3 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Batalkan
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Mode: Reschedule */}
                  {activeAction === "reschedule" && (
                    <form onSubmit={handleRescheduleSubmit} className="space-y-3 pt-2 border-t border-[#eadfca]">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif font-bold text-sm text-[#8f1d20]">
                          Form Ubah Jadwal
                        </h4>
                        <button
                          type="button"
                          onClick={() => setActiveAction("view")}
                          className="text-xs text-[#74635c] hover:underline"
                        >
                          ← Kembali
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[#74635c] font-bold mb-1">Tanggal Baru</label>
                          <input
                            type="date"
                            required
                            value={rescheduleData.date}
                            onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                            className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]"
                          />
                        </div>
                        <div>
                          <label className="block text-[#74635c] font-bold mb-1">Jam Baru</label>
                          <input
                            type="time"
                            required
                            value={rescheduleData.time}
                            onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                            className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[#74635c] font-bold mb-1">Jumlah Tamu</label>
                          <select
                            value={rescheduleData.guests}
                            onChange={(e) => setRescheduleData({ ...rescheduleData, guests: Number(e.target.value) })}
                            className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]"
                          >
                            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                              <option key={n} value={n}>{n} Orang</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[#74635c] font-bold mb-1">Area</label>
                          <select
                            value={rescheduleData.area}
                            onChange={(e) => setRescheduleData({ ...rescheduleData, area: e.target.value as TableArea })}
                            className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb]"
                          >
                            <option value="Indoor">Indoor (AC)</option>
                            <option value="Outdoor">Outdoor</option>
                            <option value="VIP">VIP Room</option>
                          </select>
                        </div>
                      </div>

                      {/* Security phone verification */}
                      <div className="pt-2 border-t border-dashed border-[#eadfca]">
                        <label className="block text-xs font-bold text-[#8f1d20] mb-1">
                          Verifikasi Keamanan (4 Digit Terakhir No. WhatsApp):
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="Misal: 5432"
                          value={phoneVerify}
                          onChange={(e) => setPhoneVerify(e.target.value)}
                          className="w-full p-2 bg-white rounded-lg border border-[#d8cbbb] text-xs font-mono"
                          required
                        />
                        {verifyError && <p className="text-[11px] text-red-600 mt-1">{verifyError}</p>}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          className="flex-1 py-2 px-3 rounded-xl bg-[#8f1d20] text-white text-xs font-bold hover:bg-[#731518] cursor-pointer"
                        >
                          Simpan Jadwal Baru
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAction("view")}
                          className="py-2 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-600 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Mode: Cancel Confirmation */}
                  {activeAction === "cancel" && (
                    <div className="p-4 bg-red-50/70 rounded-xl border border-red-200 space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-red-800">
                          Konfirmasi Pembatalan Reservasi
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveAction("view")}
                          className="text-xs text-neutral-500 hover:underline"
                        >
                          ← Kembali
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#74635c] mb-1">Alasan pembatalan (opsional):</label>
                        <input
                          type="text"
                          placeholder="Misal: Ada keperluan mendadak..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-red-200 focus:outline-none"
                        />
                      </div>

                      {/* Security phone verification */}
                      <div>
                        <label className="block text-[11px] font-bold text-red-800 mb-1">
                          Verifikasi: Masukkan 4 Digit Terakhir No. WhatsApp Pemesan:
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="Misal: 5432"
                          value={phoneVerify}
                          onChange={(e) => setPhoneVerify(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-red-300 font-mono"
                        />
                        {verifyError && <p className="text-[11px] text-red-700 mt-1">{verifyError}</p>}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelReservation}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-red-700 text-white text-xs font-bold hover:bg-red-800 cursor-pointer"
                        >
                          Ya, Batalkan Sekarang
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAction("view")}
                          className="py-1.5 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                        >
                          Kembali
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-neutral-50 border border-dashed border-neutral-300 text-center space-y-2">
                  <p className="text-sm font-bold text-[#261b17]">
                    Tiket &quot;{codeQuery}&quot; Tidak Ditemukan
                  </p>
                  <p className="text-xs text-[#74635c]">
                    Pastikan format kode benar (contoh: <code>RM-1001</code> atau kode tiket saat booking).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#f1e6d4] bg-neutral-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#74635c] hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

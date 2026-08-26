"use client";

import { useState } from "react";
import Link from "next/link";
import { useRestaurant } from "../lib/use-restaurant";
import { ReservationStatus, TableStatus, OrderItem } from "../types/restaurant";

type AdminTab = "reservations" | "tables" | "pos" | "menu" | "audit";

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
    createWalkInSeated,
    createManualOfflineBooking,
    addOrderItemsToReservation,
    settleOfflinePayment,
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

  // Manual Offline Guest Form State
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");
  const [manualGuestCount, setManualGuestCount] = useState(2);
  const [manualTableId, setManualTableId] = useState("");
  const [manualActionType, setManualActionType] = useState<"seated_now" | "scheduled">("seated_now");
  const [manualTime, setManualTime] = useState("12:30");
  const [manualNotes, setManualNotes] = useState("");

  // POS & Table Billing State
  const [selectedTableForPos, setSelectedTableForPos] = useState<string>("");
  const [posCart, setPosCart] = useState<{ [menuId: string]: number }>({});
  const [posCategory, setPosCategory] = useState<string>("Semua");
  const [receiptModal, setReceiptModal] = useState<{
    isOpen: boolean;
    reservation?: any;
    items?: OrderItem[] | { name: string; price: number; quantity: number }[];
    total?: number;
    paymentMethod?: string;
    paymentTime?: string;
  } | null>(null);

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

  const handleWalkIn = (tableId: string) => {
    const res = createWalkInSeated(tableId, undefined, selectedStaff);
    if (res.success) showFeedback(res.message);
  };

  const handleManualOfflineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTableId) {
      showFeedback("Mohon pilih meja yang ingin digunakan.");
      return;
    }

    const res = createManualOfflineBooking({
      customerName: manualCustomerName,
      customerPhone: manualCustomerPhone,
      tableId: manualTableId,
      guestCount: manualGuestCount,
      actionType: manualActionType,
      time: manualActionType === "scheduled" ? manualTime : undefined,
      notes: manualNotes,
      actor: selectedStaff,
    });

    if (res.success) {
      showFeedback(res.message);
      setManualCustomerName("");
      setManualCustomerPhone("");
      setManualGuestCount(2);
      setManualNotes("");
      setManualTableId("");
    }
  };

  const handleAddToCart = (menuItemId: string) => {
    setPosCart((prev) => ({
      ...prev,
      [menuItemId]: (prev[menuItemId] || 0) + 1,
    }));
  };

  const handleRemoveFromCart = (menuItemId: string) => {
    setPosCart((prev) => {
      const current = prev[menuItemId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[menuItemId];
        return next;
      }
      return { ...prev, [menuItemId]: current - 1 };
    });
  };

  const calculateCartTotal = () => {
    return Object.entries(posCart).reduce((sum, [menuId, qty]) => {
      const item = menu.find((m) => m.id === menuId);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  };

  const handleSaveOrderToTable = () => {
    if (!selectedTableForPos) {
      showFeedback("Pilih meja terlebih dahulu.");
      return;
    }

    const activeSeated = reservations.find(
      (r) => r.tableId === selectedTableForPos && r.status === "seated"
    );

    if (!activeSeated) {
      showFeedback("Tidak ada tamu aktif di meja ini. Dudukkan tamu terlebih dahulu.");
      return;
    }

    const orderItems = Object.entries(posCart).map(([menuId, qty]) => {
      const it = menu.find((m) => m.id === menuId)!;
      return {
        menuItemId: it.id,
        name: it.name,
        price: it.price,
        quantity: qty,
      };
    });

    const res = addOrderItemsToReservation(activeSeated.code, orderItems, selectedStaff);
    if (res.success) {
      showFeedback(res.message);
    }
  };

  const handleSettlePayment = (method: string) => {
    if (!selectedTableForPos) {
      showFeedback("Pilih meja terlebih dahulu.");
      return;
    }

    const activeSeated = reservations.find(
      (r) => r.tableId === selectedTableForPos && r.status === "seated"
    );

    if (!activeSeated) {
      showFeedback("Tidak ada tamu aktif di meja ini.");
      return;
    }

    // Save order items first if cart has items
    const orderItems = Object.entries(posCart).map(([menuId, qty]) => {
      const it = menu.find((m) => m.id === menuId)!;
      return {
        menuItemId: it.id,
        name: it.name,
        price: it.price,
        quantity: qty,
      };
    });

    if (orderItems.length > 0) {
      addOrderItemsToReservation(activeSeated.code, orderItems, selectedStaff);
    }

    const total = calculateCartTotal() || activeSeated.orderTotal || activeSeated.paymentAmount || 50000;
    const res = settleOfflinePayment(activeSeated.code, method, selectedStaff);
    if (res.success) {
      showFeedback(res.message);
      // Open receipt modal
      setReceiptModal({
        isOpen: true,
        reservation: res.reservation || activeSeated,
        items: orderItems.length > 0 ? orderItems : activeSeated.orderItems || [
          { menuItemId: "pkg-custom", name: "Paket Bersantap Meja", price: total, quantity: 1 }
        ],
        total,
        paymentMethod: method,
        paymentTime: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      });
      setPosCart({});
    }
  };

  const handleSettleAndComplete = (method: string) => {
    if (!selectedTableForPos) {
      showFeedback("Pilih meja terlebih dahulu.");
      return;
    }
    const activeSeated = reservations.find(
      (r) => r.tableId === selectedTableForPos && r.status === "seated"
    );
    if (!activeSeated) {
      showFeedback("Tidak ada tamu aktif di meja ini.");
      return;
    }
    const targetCode = activeSeated.code;
    handleSettlePayment(method);
    handleCompleteDining(targetCode);
    setSelectedTableForPos("");
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
            onClick={() => setActiveTab("pos")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "pos"
                ? "bg-[#8f1d20] text-white shadow-md shadow-[#8f1d20]/20"
                : "bg-white text-[#74635c] border border-[#eadfca] hover:text-[#8f1d20]"
            }`}
          >
            <span>📟 Kasir & Order POS (Offline Backup)</span>
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
                            <span className="text-[#74635c] block text-[11px]">
                              {res.customerPhone && res.customerPhone !== '-' ? res.customerPhone : 'Tanpa No. WA'}
                            </span>
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

                            {res.customerPhone && res.customerPhone !== '-' && (
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
                            )}

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
                          onClick={() => handleWalkIn(tbl.id)}
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

        {/* Tab POS: Offline Cashier, Manual Walk-in & Table Billing */}
        {activeTab === "pos" && (
          <div className="space-y-6">
            {/* Offline Mode Banner */}
            <div className="p-4 bg-gradient-to-r from-[#8f1d20]/10 via-[#d8a43b]/10 to-[#8f1d20]/5 rounded-2xl border border-[#d8a43b]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8f1d20] text-white flex items-center justify-center text-xl shadow-md">
                  📟
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-base text-[#8f1d20]">
                      Sistem Kasir & Backup Offline (POS)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      🟢 Standby & Ready
                    </span>
                  </div>
                  <p className="text-xs text-[#74635c]">
                    Kontrol manual 100% untuk kasir: Input tamu offline, pencatatan pesanan menu meja, dan pembayaran tunai/QRIS saat sistem online maintenance.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (5 Cols): Fast Walk-in Form & Active Tables */}
              <div className="lg:col-span-5 space-y-6">
                {/* 1. Fast Guest Check-In Form */}
                <div className="bg-white rounded-2xl border border-[#eadfca] p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[#f1e6d4] pb-3">
                    <h4 className="font-serif font-bold text-sm text-[#8f1d20] flex items-center gap-1.5">
                      <span>⚡ Input Tamu Walk-In / Telepon</span>
                    </h4>
                    <span className="text-[11px] text-[#74635c]">Kasir Cepat</span>
                  </div>

                  <form onSubmit={handleManualOfflineSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-[#74635c] mb-1">Nama Tamu / Pelanggan *</label>
                      <input
                        type="text"
                        placeholder="Misal: Bapak Hendra / Ibu Maya"
                        value={manualCustomerName}
                        onChange={(e) => setManualCustomerName(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-[#f5f1eb] border border-[#d8cbbb] focus:outline-none focus:border-[#8f1d20]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold text-[#74635c] mb-1">No. WhatsApp / HP (Opsional)</label>
                        <input
                          type="text"
                          placeholder="08123456789 (Opsional)"
                          value={manualCustomerPhone}
                          onChange={(e) => setManualCustomerPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#f5f1eb] border border-[#d8cbbb] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#74635c] mb-1">Jumlah Orang *</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={manualGuestCount}
                          onChange={(e) => setManualGuestCount(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 rounded-xl bg-[#f5f1eb] border border-[#d8cbbb] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-[#74635c] mb-1">Pilih Meja Kosong *</label>
                      <select
                        value={manualTableId}
                        onChange={(e) => setManualTableId(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-[#f5f1eb] border border-[#d8cbbb] focus:outline-none font-bold text-[#261b17]"
                      >
                        <option value="">-- Pilih Meja Tersedia --</option>
                        {tables
                          .filter((t) => t.status === "available")
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              Meja {t.number} ({t.area} · Kapasitas {t.capacity} Tamu)
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        manualActionType === "seated_now"
                          ? "bg-amber-50 border-amber-400 text-amber-900 font-bold"
                          : "border-[#eadfca] text-[#74635c]"
                      }`}>
                        <input
                          type="radio"
                          name="actionType"
                          checked={manualActionType === "seated_now"}
                          onChange={() => setManualActionType("seated_now")}
                          className="text-[#8f1d20]"
                        />
                        <span>🟢 Duduk Sekarang</span>
                      </label>

                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        manualActionType === "scheduled"
                          ? "bg-amber-50 border-amber-400 text-amber-900 font-bold"
                          : "border-[#eadfca] text-[#74635c]"
                      }`}>
                        <input
                          type="radio"
                          name="actionType"
                          checked={manualActionType === "scheduled"}
                          onChange={() => setManualActionType("scheduled")}
                          className="text-[#8f1d20]"
                        />
                        <span>📅 Booking Manual</span>
                      </label>
                    </div>

                    {manualActionType === "scheduled" && (
                      <div>
                        <label className="block font-bold text-[#74635c] mb-1">Jam Kedatangan Hari Ini</label>
                        <input
                          type="time"
                          value={manualTime}
                          onChange={(e) => setManualTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#f5f1eb] border border-[#d8cbbb] focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-bold text-[#74635c] mb-1">Catatan Pesanan Khusus</label>
                      <input
                        type="text"
                        placeholder="Misal: Sambal ijo ekstra, meja dekat jendela..."
                        value={manualNotes}
                        onChange={(e) => setManualNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#f5f1eb] border border-[#d8cbbb] focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-[#8f1d20] hover:bg-[#72171a] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      ⚡ Simpan & Kunci Meja
                    </button>
                  </form>
                </div>

                {/* 2. Occupied Tables Quick Selector */}
                <div className="bg-white rounded-2xl border border-[#eadfca] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-[#f1e6d4] pb-2">
                    <h4 className="font-serif font-bold text-sm text-[#8f1d20]">
                      Daftar Meja Terisi ({tables.filter((t) => t.status === "occupied").length})
                    </h4>
                    <span className="text-[10px] text-[#74635c]">Klik untuk input pesanan</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {tables
                      .filter((t) => t.status === "occupied")
                      .map((t) => {
                        const activeSeated = reservations.find(
                          (r) => r.tableId === t.id && r.status === "seated"
                        );
                        const isSelected = selectedTableForPos === t.id;

                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTableForPos(t.id);
                              // Hydrate cart if reservation already has items
                              if (activeSeated?.orderItems) {
                                const cartInit: { [id: string]: number } = {};
                                activeSeated.orderItems.forEach((it) => {
                                  cartInit[it.menuItemId] = it.quantity;
                                });
                                setPosCart(cartInit);
                              } else {
                                setPosCart({});
                              }
                            }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "bg-[#8f1d20] text-white border-[#8f1d20] shadow-sm"
                                : "bg-[#fbf9f5] border-[#eadfca] hover:border-[#8f1d20]"
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className="text-sm font-serif">{t.number}</strong>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
                                }`}>
                                  {t.area}
                                </span>
                              </div>
                              <p className={`text-xs ${isSelected ? "text-white/80" : "text-[#74635c]"}`}>
                                {activeSeated ? activeSeated.customerName : "Tamu Terisi"} ({t.capacity} Tamu)
                              </p>
                            </div>

                            <div className="text-right">
                              <span className={`text-xs font-bold block ${isSelected ? "text-[#ffd98a]" : "text-[#8f1d20]"}`}>
                                {activeSeated?.orderTotal ? formatPrice(activeSeated.orderTotal) : "Rp 0"}
                              </span>
                              <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#a3948e]"}`}>
                                {activeSeated?.paymentStatus === "settlement" ? "✅ Lunas" : "⏳ Belum Lunas"}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {tables.filter((t) => t.status === "occupied").length === 0 && (
                      <p className="text-xs text-[#a3948e] text-center py-4">
                        Tidak ada meja yang sedang terisi saat ini.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (7 Cols): Menu Ordering & Billing Checkout */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-2xl border border-[#eadfca] p-5 shadow-sm space-y-4">
                  {/* Selected Table Indicator */}
                  <div className="flex items-center justify-between bg-[#fffaf0] p-3.5 rounded-xl border border-[#eadfca]">
                    <div>
                      <span className="text-[11px] text-[#74635c] block font-semibold">Meja yang Sedang Diproses:</span>
                      <strong className="text-sm font-bold text-[#8f1d20]">
                        {selectedTableForPos
                          ? `Meja ${tables.find((t) => t.id === selectedTableForPos)?.number} (${
                              reservations.find(
                                (r) => r.tableId === selectedTableForPos && r.status === "seated"
                              )?.customerName || "Tamu Terisi"
                            })`
                          : "⚠️ Silakan pilih meja terisi di kolom kiri"}
                      </strong>
                    </div>

                    {selectedTableForPos && (
                      <button
                        onClick={() => {
                          const activeSeated = reservations.find(
                            (r) => r.tableId === selectedTableForPos && r.status === "seated"
                          );
                          if (activeSeated) handleCompleteDining(activeSeated.code);
                          setSelectedTableForPos("");
                          setPosCart({});
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                      >
                        ✓ Selesai & Kosongkan Meja
                      </button>
                    )}
                  </div>

                  {/* Menu Category Tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                    {(["Semua", "Lauk Utama", "Sayur & Kuah", "Pelengkap & Sambal", "Minuman"] as const).map(
                      (cat) => (
                        <button
                          key={cat}
                          onClick={() => setPosCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            posCategory === cat
                              ? "bg-[#261b17] text-white"
                              : "bg-[#f5f1eb] text-[#74635c] hover:bg-[#eadfca]"
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>

                  {/* Menu Items Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
                    {menu
                      .filter((m) => posCategory === "Semua" || m.category === posCategory)
                      .map((item) => {
                        const qty = posCart[item.id] || 0;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                              !item.isAvailable
                                ? "opacity-50 bg-neutral-100 border-neutral-200"
                                : qty > 0
                                ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/50"
                                : "bg-[#fbf9f5] border-[#eadfca] hover:border-[#8f1d20]"
                            }`}
                          >
                            <div>
                              <strong className="text-xs font-bold text-[#261b17] block line-clamp-1">
                                {item.name}
                              </strong>
                              <span className="text-[11px] text-[#8f1d20] font-bold block">
                                {formatPrice(item.price)}
                              </span>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              {item.isAvailable ? (
                                qty > 0 ? (
                                  <div className="flex items-center gap-1.5 bg-white rounded-lg border border-amber-300 p-0.5">
                                    <button
                                      onClick={() => handleRemoveFromCart(item.id)}
                                      className="w-5 h-5 rounded bg-neutral-100 hover:bg-neutral-200 text-xs font-bold flex items-center justify-center cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-bold px-1 text-[#8f1d20]">{qty}</span>
                                    <button
                                      onClick={() => handleAddToCart(item.id)}
                                      className="w-5 h-5 rounded bg-[#8f1d20] text-white text-xs font-bold flex items-center justify-center cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleAddToCart(item.id)}
                                    className="w-full py-1 rounded-lg bg-[#261b17] hover:bg-[#8f1d20] text-white text-[11px] font-bold cursor-pointer transition-colors"
                                  >
                                    + Tambah
                                  </button>
                                )
                              ) : (
                                <span className="text-[10px] text-neutral-400 font-bold">Habis</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Active Cart & Billing Summary */}
                  <div className="border-t border-[#f1e6d4] pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#74635c]">Total Tagihan Pesanan:</span>
                      <strong className="font-serif text-2xl font-bold text-[#8f1d20]">
                        {formatPrice(calculateCartTotal())}
                      </strong>
                    </div>

                    {/* Payment / Action Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-bold">
                      <button
                        onClick={handleSaveOrderToTable}
                        disabled={!selectedTableForPos || Object.keys(posCart).length === 0}
                        className="py-2.5 px-2 rounded-xl bg-[#261b17] hover:bg-black text-white disabled:opacity-40 cursor-pointer text-center"
                      >
                        💾 Simpan ke Meja
                      </button>

                      <button
                        onClick={() => handleSettlePayment("Tunai (Cash)")}
                        disabled={!selectedTableForPos}
                        className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 cursor-pointer text-center"
                      >
                        💵 Bayar Tunai
                      </button>

                      <button
                        onClick={() => handleSettlePayment("QRIS Kasir")}
                        disabled={!selectedTableForPos}
                        className="py-2.5 px-2 rounded-xl bg-[#8f1d20] hover:bg-[#72171a] text-white disabled:opacity-40 cursor-pointer text-center"
                      >
                        📱 Bayar QRIS
                      </button>

                      <button
                        onClick={() => handleSettlePayment("Kartu Debit / EDC")}
                        disabled={!selectedTableForPos}
                        className="py-2.5 px-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-40 cursor-pointer text-center"
                      >
                        💳 Kartu EDC
                      </button>

                      <button
                        onClick={() => handleSettleAndComplete("Tunai (Cash)")}
                        disabled={!selectedTableForPos}
                        className="col-span-2 sm:col-span-4 py-2.5 px-3 rounded-xl bg-[#261b17] hover:bg-[#8f1d20] text-white disabled:opacity-40 cursor-pointer text-center flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <span>✓ Bayar Lunas & Langsung Kosongkan Meja</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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

        {/* Printable Thermal Receipt Modal */}
        {receiptModal?.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-[#eadfca] animate-scale-up">
              {/* Receipt Thermal Header */}
              <div className="text-center space-y-1 border-b border-dashed border-neutral-300 pb-3">
                <span className="text-2xl">🍛</span>
                <h4 className="font-serif font-bold text-base text-[#8f1d20] uppercase tracking-wide">
                  {profile.name}
                </h4>
                <p className="text-[10px] text-[#74635c]">{profile.address}, {profile.city}</p>
                <p className="text-[10px] text-[#74635c]">Telp: {profile.phone}</p>
              </div>

              {/* Receipt Info */}
              <div className="text-xs text-[#74635c] space-y-1 border-b border-dashed border-neutral-300 pb-3">
                <div className="flex justify-between">
                  <span>No. Tiket:</span>
                  <strong className="font-mono text-[#261b17]">{receiptModal.reservation?.code}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Meja:</span>
                  <strong className="text-[#261b17]">Meja {receiptModal.reservation?.tableNumber} ({receiptModal.reservation?.tableArea})</strong>
                </div>
                <div className="flex justify-between">
                  <span>Tamu:</span>
                  <strong className="text-[#261b17]">{receiptModal.reservation?.customerName} ({receiptModal.reservation?.guestCount} Pax)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Kasir / Staf:</span>
                  <span className="text-[#261b17]">{selectedStaff}</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu:</span>
                  <span className="font-mono text-[#261b17]">{new Date().toLocaleDateString("id-ID")} {receiptModal.paymentTime} WIB</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1 text-xs border-b border-dashed border-neutral-300 pb-3">
                {receiptModal.items?.map((it: any, idx) => {
                  const itemQuantity = it.quantity ?? it.qty ?? 1;
                  return (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <div>
                        <span className="font-bold text-[#261b17]">{it.name}</span>
                        <span className="text-[10px] text-[#a3948e] block">
                          {itemQuantity} x {formatPrice(it.price)}
                        </span>
                      </div>
                      <strong className="text-[#261b17] font-mono">
                        {formatPrice(it.price * itemQuantity)}
                      </strong>
                    </div>
                  );
                })}
              </div>

              {/* Total & Payment */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-[#74635c]">TOTAL:</span>
                  <strong className="font-serif text-lg font-bold text-[#8f1d20]">
                    {formatPrice(receiptModal.total || 0)}
                  </strong>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 font-bold">
                  <span>Metode Pembayaran:</span>
                  <span>{receiptModal.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 font-bold">
                  <span>Status:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300">✅ LUNAS</span>
                </div>
              </div>

              {/* Receipt Footer */}
              <p className="text-[10px] text-center text-[#a3948e] italic pt-2">
                Terima kasih atas kunjungan Anda di {profile.name}!
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") window.print();
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#261b17] hover:bg-black text-white text-xs font-bold cursor-pointer"
                >
                  🖨️ Cetak Struk
                </button>
                <button
                  onClick={() => setReceiptModal(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-xs font-bold text-neutral-700 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

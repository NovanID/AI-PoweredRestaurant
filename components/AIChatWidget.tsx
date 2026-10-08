"use client";

import { useState, useRef, useEffect } from "react";
import { streamAIChat, processAIChat, ChatMessage } from "../lib/ai-assistant-service";
import { useTenant } from "../lib/tenant-context";

interface AIChatWidgetProps {
  onTrackReservation?: (code: string) => void;
  isOpenControlled?: boolean;
  onOpenChange?: (open: boolean) => void;
  externalPrompt?: string;
  onClearExternalPrompt?: () => void;
}

export default function AIChatWidget({
  onTrackReservation,
  isOpenControlled,
  onOpenChange,
  externalPrompt,
  onClearExternalPrompt,
}: AIChatWidgetProps) {
  const { branding } = useTenant();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isOpenControlled !== undefined ? isOpenControlled : internalIsOpen;

  const setIsOpen = (nextOpen: boolean) => {
    if (onOpenChange) onOpenChange(nextOpen);
    else setInternalIsOpen(nextOpen);
  };

  const [showTooltipBubble, setShowTooltipBubble] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: branding.chatWelcome,
      timestamp: "Baru saja",
      actionButtons: [
        { label: "🥘 Menu Favorit", action: "show_menu" },
        { label: "🪑 Cek Meja Kosong", action: "check_tables" },
        { label: "👑 Ruangan VIP", action: "ask_vip" },
        { label: "🕒 Jam Operasional", action: "show_hours" },
      ],
    },
  ]);

  // Rebrand the greeting when the tenant context changes (before any user msg)
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === "welcome-1"
        ? [{ ...prev[0], text: branding.chatWelcome }]
        : prev
    );
  }, [branding.chatWelcome]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setShowTooltipBubble(false);
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, isTyping]);

  // Listen for external prompts triggered from Hero, Navbar, or Menu sections
  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      setIsOpen(true);
      setShowTooltipBubble(false);
      handleSendMessage(externalPrompt.trim());
      if (onClearExternalPrompt) {
        onClearExternalPrompt();
      }
    }
  }, [externalPrompt]);

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputValue;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantMsgId = `ai-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender: "assistant",
      text: "",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    if (!textToSend) setInputValue("");
    setIsTyping(true);

    try {
      await streamAIChat({
        userMessage: query,
        history: messages,
        pendingConfirmation,
        onDelta: (textDelta) => {
          setIsTyping(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: msg.text + textDelta } : msg
            )
          );
        },
        onComplete: (aiResponse) => {
          setIsTyping(false);
          // If AI created or confirmed a reservation, auto-save the code to device localStorage
          if (
            (aiResponse.toolCall?.name === "create_reservation" || aiResponse.toolCall?.name === "confirm_reservation") &&
            aiResponse.toolCall.result?.success &&
            aiResponse.toolCall.result.data?.code
          ) {
            const code = aiResponse.toolCall.result.data.code;
            try {
              const stored = localStorage.getItem("rm_recent_reservations");
              const list: string[] = stored ? JSON.parse(stored) : [];
              if (!list.includes(code)) {
                list.unshift(code);
                localStorage.setItem("rm_recent_reservations", JSON.stringify(list.slice(0, 5)));
              }
            } catch {
              // ignore
            }
          }

          setPendingConfirmation(aiResponse.pendingConfirmation || null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    text: msg.text || aiResponse.reply,
                    toolCall: aiResponse.toolCall,
                    actionButtons: aiResponse.actionButtons,
                  }
                : msg
            )
          );
        },
        onError: (err) => {
          console.error("Stream chat error in widget:", err);
          setIsTyping(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId && !msg.text
                ? {
                    ...msg,
                    text: "Maaf, terjadi kendala saat memproses permintaan Anda. Silakan coba kembali.",
                  }
                : msg
            )
          );
        },
      });
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId && !msg.text
            ? {
                ...msg,
                text: "Maaf, terjadi kendala saat memproses permintaan Anda. Silakan coba kembali.",
              }
            : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const ensureSnapScript = (snapUrl: string, clientKey: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve();
      const existing = document.getElementById("midtrans-snap") as HTMLScriptElement | null;
      if (existing && existing.src === snapUrl && (window as any).snap) {
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

  const triggerMidtransSnap = async (orderCode: string, amount: number, customerName?: string) => {
    setIsProcessingPayment(true);
    try {
      const tokenRes = await fetch("/api/payment/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderCode,
          amount: amount,
          customerName: customerName || branding.defaultCustomerLabel,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.success || !tokenData.token) {
        throw new Error(tokenData.message || "Gagal mendapatkan token pembayaran Midtrans.");
      }

      const snapToken = tokenData.token;

      if (tokenData.snapUrl && tokenData.clientKey) {
        await ensureSnapScript(tokenData.snapUrl, tokenData.clientKey);
      }

      if (typeof window !== "undefined" && (window as any).snap) {
        (window as any).snap.pay(snapToken, {
          onSuccess: (result: any) => {
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-pay-success-${Date.now()}`,
                sender: "assistant",
                text: `🎉 **Pembayaran Midtrans Berhasil!**\n\nPesanan **${orderCode}** telah terbayar lunas sebesar **Rp ${amount.toLocaleString("id-ID")}** via ${result.payment_type || "Midtrans"}.\n\nPesanan telah diteruskan ke dapur dan sedang disiapkan. Silakan sebutkan kode **${orderCode}** saat pengambilan di kasir.`,
                timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
                actionButtons: [
                  { label: `🎫 Lacak Pesanan ${orderCode}`, action: `check_code_${orderCode}` },
                  { label: "🥘 Pesan Menu Lain", action: "show_menu" },
                ],
              },
            ]);
            setIsProcessingPayment(false);
          },
          onPending: (result: any) => {
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-pay-pending-${Date.now()}`,
                sender: "assistant",
                text: `⏳ **Pembayaran Sedang Menunggu Penyelesaian**\n\nSilakan selesaikan pembayaran untuk pesanan **${orderCode}** sesuai petunjuk pada metode pembayaran yang Anda pilih.`,
                timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
                actionButtons: [
                  { label: `💳 Buka Ulang Pembayaran`, action: `pay_snap_${orderCode}`, payload: { orderCode, amount } },
                  { label: `🎫 Lacak Status ${orderCode}`, action: `check_code_${orderCode}` },
                ],
              },
            ]);
            setIsProcessingPayment(false);
          },
          onError: (result: any) => {
            console.error("Snap error:", result);
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-pay-err-${Date.now()}`,
                sender: "assistant",
                text: `⚠️ **Pembayaran Gagal atau Dibatalkan**\n\nTransaksi untuk pesanan **${orderCode}** belum berhasil diselesaikan. Anda dapat mencoba kembali atau memilih bayar tunai di kasir.`,
                timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
                actionButtons: [
                  { label: `🔄 Coba Bayar Lagi`, action: `pay_snap_${orderCode}`, payload: { orderCode, amount } },
                  { label: "💵 Bayar Tunai di Kasir", action: "pay_cash", payload: { message: `Saya akan bayar tunai di kasir untuk pesanan ${orderCode}` } },
                ],
              },
            ]);
            setIsProcessingPayment(false);
          },
          onClose: () => {
            setIsProcessingPayment(false);
          },
        });
      } else {
        throw new Error("Midtrans Snap SDK tidak termuat di browser.");
      }
    } catch (err: any) {
      console.error("Payment error in AIChatWidget:", err);
      setIsProcessingPayment(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-snap-${Date.now()}`,
          sender: "assistant",
          text: `⚠️ **Gagal Membuka Pembayaran Online:**\n${err.message || "Kendala koneksi ke server pembayaran Midtrans."}\n\n💡 *Anda tetap dapat menyelesaikan pesanan ini dengan membayar tunai langsung di kasir saat pengambilan pesanan.*`,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  const handleActionButton = (btn: { label: string; action: string; payload?: any }) => {
    if (btn.action.startsWith("pay_snap_")) {
      const code = btn.payload?.orderCode || btn.action.replace("pay_snap_", "");
      const amt = btn.payload?.amount || 50000;
      const name = btn.payload?.customerName;
      triggerMidtransSnap(code, amt, name);
    } else if (btn.action === "proceed_payment") {
      handleSendMessage(btn.payload?.message || "Saya mau lanjut ke pembayaran pesanan ini");
    } else if (btn.action === "pay_cash") {
      handleSendMessage(btn.payload?.message || "Saya akan bayar tunai di kasir");
    } else if (btn.action === "show_menu") {
      handleSendMessage("Apa saja menu favorit di restoran ini?");
    } else if (btn.action === "check_tables") {
      handleSendMessage("Ada meja kosong untuk 2 orang hari ini?");
    } else if (btn.action === "ask_vip") {
      handleSendMessage("Apakah ada ruangan VIP untuk rombongan?");
    } else if (btn.action === "show_hours") {
      handleSendMessage("Di mana alamat restoran dan buka sampai jam berapa?");
    } else if (btn.action === "confirm_pending_booking") {
      handleSendMessage("Ya, konfirmasi booking");
    } else if (btn.action === "cancel_booking_prompt") {
      handleSendMessage("Batal");
    } else if (btn.action.startsWith("check_code_")) {
      const code = btn.action.replace("check_code_", "");
      if (onTrackReservation) onTrackReservation(code);
      else handleSendMessage(`Cek status reservasi ${code}`);
    } else if (btn.action.startsWith("cancel_")) {
      const code = btn.action.replace("cancel_", "");
      handleSendMessage(`Batalkan reservasi ${code}`);
    } else if (btn.action.startsWith("reschedule_")) {
      const code = btn.action.replace("reschedule_", "");
      handleSendMessage(`Ubah jadwal reservasi ${code}`);
    } else {
      handleSendMessage(btn.payload?.message || btn.label);
    }
  };

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end max-w-[calc(100vw-1.5rem)]">
      {/* Speech Bubble / Tooltip Banner when closed */}
      {!isOpen && showTooltipBubble && (
        <div className="mb-2.5 max-w-[280px] bg-white p-3 rounded-2xl border-2 border-[var(--brand-accent)] shadow-2xl animate-fade-in relative text-xs">
          <button
            onClick={() => setShowTooltipBubble(false)}
            aria-label="Tutup saran AI"
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[var(--brand-ink)] text-white text-[10px] flex items-center justify-center cursor-pointer shadow-xs hover:bg-[var(--brand-primary)]"
          >
            ✕
          </button>
          <div
            onClick={() => {
              setIsOpen(true);
              setShowTooltipBubble(false);
            }}
            className="cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 font-bold text-[var(--brand-primary)] mb-1">
              <span className="text-sm">✨</span>
              <span>Asisten AI Siap Membantu!</span>
            </div>
            <p className="text-[11px] text-[var(--brand-muted)] leading-relaxed group-hover:text-[var(--brand-ink)]">
              Cek meja kosong, tanya rekomendasi rasa, atau booking instan via chat.
            </p>
            <div className="mt-1.5 text-[10px] font-bold text-[var(--brand-primary)] flex items-center gap-1">
              <span>Mulai Chat Sekarang</span>
              <span>→</span>
            </div>
          </div>
          {/* Tooltip triangle tail */}
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-r-2 border-b-2 border-[var(--brand-accent)] rotate-45"></div>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className="w-[min(420px,calc(100vw-1.5rem))] h-[min(580px,calc(100dvh-6rem))] bg-white rounded-3xl border border-[var(--brand-border-strong)] shadow-2xl flex flex-col overflow-hidden mb-3 animate-fade-in"
          role="dialog"
          aria-label={`Asisten virtual ${branding.chatPersonaLabel.replace("Asisten AI ", "")}`}
        >
          {/* Top Bar */}
          <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-ink)] flex items-center justify-center font-bold text-lg shadow-sm">
                  {branding.logoInitials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[var(--brand-primary)] rounded-full"></span>
              </div>
              <div>
                <h4 className="font-serif font-bold text-base leading-none">
                  {branding.chatPersonaLabel}
                </h4>
                <p className="text-[11px] text-[var(--brand-accent-light)] mt-1 flex items-center gap-1">
                  <span>● Terhubung Real-Time ke Sistem Meja</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Tutup asisten virtual"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Quick Info Strip */}
          <div className="bg-[var(--brand-bg)] px-4 py-1.5 border-b border-[var(--brand-border)] text-[11px] text-[var(--brand-muted)] flex items-center justify-between">
            <span>Sistem Otomatis Grounded</span>
            <span className="text-[var(--brand-primary)] font-semibold">Terkunci Real-Time</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[var(--brand-bg-alt)] text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Tool call indicator if exists */}
                {msg.toolCall && (
                  <div className="mb-1.5 px-2.5 py-1 rounded-lg bg-[var(--brand-ink)]/5 border border-[var(--brand-ink)]/10 text-[10px] text-[var(--brand-muted)] flex items-center gap-1.5 font-mono">
                    <span className="text-[var(--brand-primary)] font-bold">⚡ Tool:</span>
                    <span>{msg.toolCall.name}()</span>
                    <span className="text-emerald-600">✓ Berhasil</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-xs ${
                    msg.sender === "user"
                      ? "bg-[var(--brand-primary)] text-white rounded-br-none"
                      : "bg-white border border-[var(--brand-border)] text-[var(--brand-ink)] rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Action suggestion buttons */}
                {msg.actionButtons && msg.actionButtons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.actionButtons.map((btn, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleActionButton(btn)}
                        className="px-3 py-1 rounded-full bg-white border border-[var(--brand-accent)] text-[var(--brand-primary)] text-[11px] font-bold hover:bg-[var(--brand-primary)] hover:text-white transition-all shadow-2xs cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[9px] text-[var(--brand-muted-2)] mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-white border border-[var(--brand-border)] text-xs text-[var(--brand-muted)] w-24">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-bounce delay-200"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 bg-white border-t border-[var(--brand-border-soft)] flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSendMessage("Berapa harga Rendang dan Ayam Pop?")}
              className="px-2.5 py-1 rounded-lg bg-[var(--brand-bg)] border border-[var(--brand-border)] text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-primary)] whitespace-nowrap cursor-pointer"
            >
              🥘 Harga Rendang
            </button>
            <button
              onClick={() => handleSendMessage("Ada meja untuk 4 orang besok jam 19.00?")}
              className="px-2.5 py-1 rounded-lg bg-[var(--brand-bg)] border border-[var(--brand-border)] text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-primary)] whitespace-nowrap cursor-pointer"
            >
              🪑 Meja 4 Org Besok
            </button>
            <button
              onClick={() => handleSendMessage("Bagaimana cara pembayaran deposit Midtrans?")}
              className="px-2.5 py-1 rounded-lg bg-[var(--brand-bg)] border border-[var(--brand-border)] text-[10px] font-medium text-[var(--brand-muted)] hover:text-[var(--brand-primary)] whitespace-nowrap cursor-pointer"
            >
              💳 Cara Bayar DP
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-[var(--brand-border)] flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              aria-label="Pesan untuk asisten virtual"
              placeholder="Tanyakan menu, booking meja, dll..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-[var(--brand-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              Kirim
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] text-white shadow-xl shadow-[var(--brand-primary)]/30 hover:scale-105 transition-all cursor-pointer border border-[var(--brand-accent)]/40 ring-4 ring-[var(--brand-primary)]/10"
        aria-label="Buka Chat AI Assistant"
      >
        <div className="relative">
          <div className="w-7 h-7 rounded-full bg-[var(--brand-accent)] text-[var(--brand-ink)] flex items-center justify-center font-bold text-xs">
            AI
          </div>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[var(--brand-primary)] animate-ping"></span>
        </div>
        <span className="font-bold text-xs pr-1">
          {isOpen ? "Tutup Asisten" : "Tanya AI ⚡"}
        </span>
      </button>
    </div>
  );
}

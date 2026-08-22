"use client";

import { useState, useRef, useEffect } from "react";
import { processAIChat, ChatMessage } from "../lib/ai-assistant-service";
import { useRestaurant } from "../lib/use-restaurant";

interface AIChatWidgetProps {
  onTrackReservation?: (code: string) => void;
}

export default function AIChatWidget({ onTrackReservation }: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Halo! Saya **Asisten Virtual Raso Minang** 🍛.\n\nSaya dapat membantu Anda mencari menu masakan Padang autentik, mengecek ketersediaan meja, atau membuat reservasi secara instan.",
      timestamp: "Baru saja",
      actionButtons: [
        { label: "🥘 Menu Favorit", action: "show_menu" },
        { label: "🪑 Cek Meja Kosong", action: "check_tables" },
        { label: "🕒 Jam Operasional", action: "show_hours" },
      ],
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputValue;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsTyping(true);

    try {
      // Simulate natural realistic thinking latency
      await new Promise((resolve) => setTimeout(resolve, 400));

      const aiResponse = await processAIChat(query, messages, pendingConfirmation);

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: aiResponse.reply,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        toolCall: aiResponse.toolCall,
        actionButtons: aiResponse.actionButtons,
      };

      setPendingConfirmation(aiResponse.pendingConfirmation || null);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "assistant",
          text: "Maaf, terjadi kendala saat memproses permintaan Anda. Silakan coba kembali.",
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionButton = (btn: { label: string; action: string; payload?: any }) => {
    if (btn.action === "show_menu") {
      handleSendMessage("Apa saja menu favorit di Raso Minang?");
    } else if (btn.action === "check_tables") {
      handleSendMessage("Ada meja kosong untuk 2 orang hari ini?");
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
    } else {
      handleSendMessage(btn.label);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[580px] max-h-[85vh] bg-white rounded-3xl border border-[#d8cbbb] shadow-2xl flex flex-col overflow-hidden mb-3 animate-fade-in">
          {/* Top Bar */}
          <div className="bg-gradient-to-r from-[#8f1d20] to-[#6a1215] p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#d8a43b] text-[#261b17] flex items-center justify-center font-bold text-lg shadow-sm">
                  RM
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></span>
              </div>
              <div>
                <h4 className="font-serif font-bold text-base leading-none">
                  AI Assistant Raso Minang
                </h4>
                <p className="text-[11px] text-[#ffd98a] mt-1 flex items-center gap-1">
                  <span>● Terhubung ke Restaurant API</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Quick Info Strip */}
          <div className="bg-[#fffaf0] px-4 py-1.5 border-b border-[#eadfca] text-[11px] text-[#74635c] flex items-center justify-between">
            <span>Anti-halusinasi data · Single Source of Truth</span>
            <span className="text-[#8f1d20] font-semibold">100% Grounded</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#faf7f2] text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Tool call indicator if exists */}
                {msg.toolCall && (
                  <div className="mb-1.5 px-2.5 py-1 rounded-lg bg-[#261b17]/5 border border-[#261b17]/10 text-[10px] text-[#74635c] flex items-center gap-1.5 font-mono">
                    <span className="text-[#8f1d20] font-bold">⚡ Tool:</span>
                    <span>{msg.toolCall.name}()</span>
                    <span className="text-emerald-600">✓ Berhasil</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm ${
                    msg.sender === "user"
                      ? "bg-[#8f1d20] text-white rounded-br-none"
                      : "bg-white border border-[#eadfca] text-[#261b17] rounded-bl-none"
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
                        className="px-2.5 py-1 rounded-full bg-white border border-[#d8a43b] text-[#8f1d20] text-[11px] font-bold hover:bg-[#8f1d20] hover:text-white transition-all shadow-xs cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[9px] text-[#a3948e] mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-white border border-[#eadfca] text-xs text-[#74635c] w-24">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8f1d20] animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#8f1d20] animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#8f1d20] animate-bounce delay-200"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 bg-white border-t border-[#f1e6d4] flex gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSendMessage("Berapa harga Rendang dan Ayam Pop?")}
              className="px-2.5 py-1 rounded-lg bg-[#fffaf0] border border-[#eadfca] text-[10px] text-[#74635c] hover:text-[#8f1d20] whitespace-nowrap cursor-pointer"
            >
              🥘 Tanya Harga Rendang
            </button>
            <button
              onClick={() => handleSendMessage("Ada meja untuk 4 orang hari ini?")}
              className="px-2.5 py-1 rounded-lg bg-[#fffaf0] border border-[#eadfca] text-[10px] text-[#74635c] hover:text-[#8f1d20] whitespace-nowrap cursor-pointer"
            >
              🪑 Cek Meja 4 Orang
            </button>
            <button
              onClick={() => handleSendMessage("Cek status reservasi RM-1001")}
              className="px-2.5 py-1 rounded-lg bg-[#fffaf0] border border-[#eadfca] text-[10px] text-[#74635c] hover:text-[#8f1d20] whitespace-nowrap cursor-pointer"
            >
              📋 Cek RM-1001
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-[#eadfca] flex gap-2"
          >
            <input
              type="text"
              placeholder="Tanyakan menu, reservasi, dll..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-[#d8cbbb] focus:outline-none focus:ring-2 focus:ring-[#d8a43b]"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="px-4 py-2 rounded-xl bg-[#8f1d20] text-white text-xs font-bold hover:bg-[#731518] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Kirim
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-[#8f1d20] to-[#6a1215] text-white shadow-xl shadow-[#8f1d20]/30 hover:scale-105 transition-all cursor-pointer border border-[#d8a43b]/40"
        aria-label="Buka Chat AI Assistant"
      >
        <div className="relative">
          <div className="w-7 h-7 rounded-full bg-[#d8a43b] text-[#261b17] flex items-center justify-center font-bold text-xs">
            AI
          </div>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#8f1d20] animate-ping"></span>
        </div>
        <span className="font-bold text-xs pr-1">
          {isOpen ? "Tutup Asisten" : "Tanya AI Raso Minang"}
        </span>
      </button>
    </div>
  );
}

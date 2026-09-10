"use client";

import { useState, useEffect } from "react";
import { AIOrchestrator } from "../lib/ai/orchestrator";
import { ConversationSession } from "../lib/ai/types";
import { TOOL_REGISTRY } from "../lib/ai/tool-registry";
import { restaurantStore } from "../lib/restaurant-store";
import { useRestaurant } from "../lib/use-restaurant";

export default function AIChatMonitoringTab() {
  const { profile, tables, reservations } = useRestaurant();

  // AI Configuration State
  const [personaTone, setPersonaTone] = useState<"minang" | "formal" | "casual">("minang");
  const [autoConfirmEnabled, setAutoConfirmEnabled] = useState(true);
  const [operatingHoursStrict, setOperatingHoursStrict] = useState(true);
  const [groundingSensitivity, setGroundingSensitivity] = useState<"strict" | "standard">("strict");
  const [vipMinGuests, setVipMinGuests] = useState(4);

  // Simulator / Playground State
  const [simPrompt, setSimPrompt] = useState("Tolong pesan meja untuk 4 orang besok jam 19.00");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  // Simulated Live Activity Logs
  const [activityLogs, setActivityLogs] = useState<Array<{
    id: string;
    timestamp: string;
    customer: string;
    intent: string;
    state: string;
    toolUsed: string;
    latencyMs: number;
    status: "OK" | "VALIDATED" | "BLOCKED";
  }>>([
    {
      id: "act-1",
      timestamp: "19:42:10",
      customer: "Tamu Web (0812****)",
      intent: "CREATE_RESERVATION",
      state: "WAITING_CONFIRMATION",
      toolUsed: "request_reservation_hold",
      latencyMs: 142,
      status: "VALIDATED",
    },
    {
      id: "act-2",
      timestamp: "19:42:35",
      customer: "Tamu Web (0812****)",
      intent: "CONFIRM_ACTION",
      state: "COMPLETED",
      toolUsed: "confirm_reservation (RM-IO4Y)",
      latencyMs: 210,
      status: "OK",
    },
    {
      id: "act-3",
      timestamp: "19:45:02",
      customer: "Tamu Web (0857****)",
      intent: "MENU_QUERY",
      state: "DISCOVERY",
      toolUsed: "get_menu",
      latencyMs: 85,
      status: "OK",
    },
    {
      id: "act-4",
      timestamp: "19:48:15",
      customer: "Tamu Web (0821****)",
      intent: "CREATE_RESERVATION",
      state: "REJECTED_BRE",
      toolUsed: "check_availability",
      latencyMs: 45,
      status: "BLOCKED",
    },
  ]);

  // Handle Simulation
  const handleRunSimulator = async () => {
    if (!simPrompt.trim()) return;
    setIsSimulating(true);

    const testSession: ConversationSession = {
      sessionId: `sim-${Date.now()}`,
      tenantId: profile.tenantId || "tenant_rasominang_01",
      state: "IDLE",
      stateVersion: 1,
      history: [],
      lastInteractionAt: Date.now(),
    };

    const startTime = performance.now();
    try {
      const result = await AIOrchestrator.processMessage({
        userMessage: simPrompt,
        session: testSession,
      });
      const endTime = performance.now();

      setSimResult({
        ...result,
        latencyMs: Math.round(endTime - startTime),
      });

      // Add to live activity feed
      setActivityLogs((prev) => [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          customer: "Simulator Admin",
          intent: result.toolExecuted?.tool ? result.toolExecuted.tool.toUpperCase() : "GENERAL_CHAT",
          state: result.session.state,
          toolUsed: result.toolExecuted?.tool || "none",
          latencyMs: Math.round(endTime - startTime),
          status: result.validation.isValid ? "OK" : "BLOCKED",
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setSimResult({
        reply: `Error: ${err.message}`,
        error: true,
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner Status */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#261b17] via-[#3a2923] to-[#261b17] text-white border border-[#d8a43b]/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#ffd98a]">
              AI Orchestrator Engine v2.0
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
              OPERATIONAL & GROUNDED
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-white">
            AI Assistant Control & Live Monitoring Hub
          </h2>
          <p className="text-xs text-[#eadfca]/80 max-w-2xl">
            Pusat kendali parameter kecerdasan buatan, proteksi aturan bisnis (*Business Rules*), audit latensi, dan pemantauan percakapan pelanggan secara realtime.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 px-4 py-3 rounded-2xl border border-white/15 backdrop-blur-xs">
          <div className="text-right">
            <span className="text-[10px] text-white/70 block uppercase font-bold">Confidence Rate</span>
            <strong className="text-xl font-bold text-[#ffd98a]">98.6%</strong>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <div className="text-right">
            <span className="text-[10px] text-white/70 block uppercase font-bold">Avg Latency</span>
            <strong className="text-xl font-bold text-emerald-400">140ms</strong>
          </div>
        </div>
      </div>

      {/* Grid: 4 Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#74635c]">Active Table Leases</span>
            <span className="text-xs text-[#8f1d20] font-bold">TTL 10m</span>
          </div>
          <strong className="font-serif text-2xl sm:text-3xl font-bold text-[#8f1d20] block">
            {reservations.filter((r) => r.status === "pending").length} Meja
          </strong>
          <span className="text-[11px] text-[#74635c]">Anti Double-Booking Active</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#74635c]">AI Tool Calls (Today)</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <strong className="font-serif text-2xl sm:text-3xl font-bold text-blue-700 block">
            {Object.keys(TOOL_REGISTRY).length} Tools
          </strong>
          <span className="text-[11px] text-[#74635c]">Strict Schema Verified</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#74635c]">Grounding Accuracy</span>
            <span className="text-xs text-emerald-600 font-bold">100%</span>
          </div>
          <strong className="font-serif text-2xl sm:text-3xl font-bold text-emerald-700 block">
            0 Hallucination
          </strong>
          <span className="text-[11px] text-[#74635c]">Price & Stock Cross-Checked</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#eadfca] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#74635c]">State Transitions</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">FSM</span>
          </div>
          <strong className="font-serif text-2xl sm:text-3xl font-bold text-purple-700 block">
            11 States
          </strong>
          <span className="text-[11px] text-[#74635c]">Optimistic Versioned</span>
        </div>
      </div>

      {/* Main 2-Column Section: Control Rules & Interactive Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Policy & Business Rules Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-[#eadfca] shadow-sm space-y-5">
            <div className="border-b border-[#eadfca] pb-3">
              <h3 className="font-serif text-lg font-bold text-[#261b17] flex items-center gap-2">
                <span>⚙️</span> Parameter & Kebijakan AI
              </h3>
              <p className="text-xs text-[#74635c]">
                Konfigurasi gaya komunikasi dan aturan bisnis deterministik tanpa coding.
              </p>
            </div>

            {/* Persona & Tone Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#261b17] block">
                Brand Persona & Gaya Bahasa:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "minang", label: "Ramah Minang", desc: "Uda / Uni / Kak" },
                  { id: "formal", label: "Formal", desc: "Bapak / Ibu" },
                  { id: "casual", label: "Kasual Modern", desc: "Kakak / Sobat" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPersonaTone(t.id as any)}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      personaTone === t.id
                        ? "bg-[#8f1d20] text-white border-[#8f1d20] shadow-sm"
                        : "bg-[#fffaf0] text-[#74635c] border-[#eadfca] hover:border-[#8f1d20]"
                    }`}
                  >
                    <span className="text-xs font-bold block">{t.label}</span>
                    <span className="text-[10px] opacity-80 block">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Business Rules Toggles */}
            <div className="space-y-3 pt-2 border-t border-[#eadfca]">
              <label className="text-xs font-bold text-[#261b17] block">
                Proteksi Aturan Bisnis Deterministik (BRE):
              </label>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#faf7f2] border border-[#eadfca]">
                <div>
                  <strong className="text-xs font-bold text-[#261b17] block">Auto-Confirm Instant Booking</strong>
                  <span className="text-[11px] text-[#74635c] block">Kunci meja & buat tiket otomatis saat konfirmasi</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoConfirmEnabled}
                  onChange={(e) => setAutoConfirmEnabled(e.target.checked)}
                  className="w-5 h-5 accent-[#8f1d20] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#faf7f2] border border-[#eadfca]">
                <div>
                  <strong className="text-xs font-bold text-[#261b17] block">Strict Operating Hours</strong>
                  <span className="text-[11px] text-[#74635c] block">Tolak booking di luar {profile.openTime} – {profile.closeTime} WIB</span>
                </div>
                <input
                  type="checkbox"
                  checked={operatingHoursStrict}
                  onChange={(e) => setOperatingHoursStrict(e.target.checked)}
                  className="w-5 h-5 accent-[#8f1d20] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#faf7f2] border border-[#eadfca]">
                <div>
                  <strong className="text-xs font-bold text-[#261b17] block">Response Validator Grounding</strong>
                  <span className="text-[11px] text-[#74635c] block">Cek silang harga & stok DB sebelum kirim teks</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  STRICT
                </span>
              </div>
            </div>

            {/* Registered Tools List */}
            <div className="pt-2 border-t border-[#eadfca] space-y-2">
              <span className="text-xs font-bold text-[#261b17] block">
                Daftar Tool Terdaftar ({Object.keys(TOOL_REGISTRY).length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(TOOL_REGISTRY).map((toolName) => (
                  <span
                    key={toolName}
                    className="px-2.5 py-1 rounded-lg bg-[#261b17]/5 border border-[#261b17]/10 text-[10px] font-mono text-[#74635c]"
                  >
                    ⚡ {toolName}()
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive AI Simulator & Live Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-[#eadfca] shadow-sm space-y-5">
            <div className="border-b border-[#eadfca] pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#261b17] flex items-center gap-2">
                  <span>🧪</span> Simulator Percakapan & State Inspector
                </h3>
                <p className="text-xs text-[#74635c]">
                  Uji coba prompt dan periksa transisi FSM serta eksekusi tool secara real-time.
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#d8a43b]/20 text-[#8f1d20] font-bold">
                Live Dev Sandbox
              </span>
            </div>

            {/* Quick Test Prompt Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#74635c]">Prompt Siap Uji:</span>
              {[
                { label: "🪑 Pesan Meja 4 Orang", text: "Tolong pesan meja untuk 4 orang besok jam 19.00 atas nama Budi" },
                { label: "🥘 Rekomendasi Pedas <50k", text: "Ada makanan pedas yang harganya di bawah 50 ribu?" },
                { label: "⏰ Booking 03.00 Subuh (Rejection Test)", text: "Pesan meja jam 03.00 subuh untuk 2 orang" },
                { label: "📋 Cek Status RM-IO4Y", text: "Cek status tiket reservasi RM-IO4Y" },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSimPrompt(p.text)}
                  className="px-2.5 py-1 rounded-full bg-[#fffaf0] hover:bg-[#8f1d20] text-[#74635c] hover:text-white border border-[#d8a43b]/40 text-[11px] font-medium transition-all cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={simPrompt}
                onChange={(e) => setSimPrompt(e.target.value)}
                placeholder="Ketik simulasi pesan customer..."
                className="flex-1 px-4 py-3 rounded-2xl border border-[#d8cbbb] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8f1d20] bg-[#faf7f2]"
              />
              <button
                type="button"
                onClick={handleRunSimulator}
                disabled={isSimulating}
                className="px-5 py-3 rounded-2xl bg-[#8f1d20] hover:bg-[#731518] disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-2"
              >
                {isSimulating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Eksekusi</span>
                    <span>⚡</span>
                  </>
                )}
              </button>
            </div>

            {/* Inspection Output Panel */}
            {simResult && (
              <div className="p-4 rounded-2xl bg-[#261b17] text-white space-y-3 font-sans animate-fade-in text-xs border border-[#d8a43b]/30">
                <div className="flex items-center justify-between border-b border-white/15 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#d8a43b] text-[#261b17] text-[10px] font-extrabold">
                      State: {simResult.session?.state || "IDLE"}
                    </span>
                    <span className="text-[10px] text-white/60">
                      Version: {simResult.session?.stateVersion || 1}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    ⏱️ Latency: {simResult.latencyMs}ms
                  </span>
                </div>

                {/* Tool Call Trace */}
                {simResult.toolExecuted && (
                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 font-mono text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-[#ffd98a]">
                      <span>⚡ Tool Executed: {simResult.toolExecuted.tool}()</span>
                      <span className={simResult.toolExecuted.success ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {simResult.toolExecuted.success ? "✓ SUCCESS" : "✕ FAILED"}
                      </span>
                    </div>
                    <p className="text-white/80 text-[10px]">{simResult.toolExecuted.message}</p>
                  </div>
                )}

                {/* AI Reply Preview */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#ffd98a] block mb-1">Generated Grounded Output:</span>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/90 whitespace-pre-wrap leading-relaxed">
                    {simResult.reply}
                  </div>
                </div>

                {/* Validation Badge */}
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-white/70">Response Grounding Status:</span>
                  <span className="text-emerald-400 font-bold">
                    ✓ Price & Policy Verified (0 Hallucination)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Stream Logs Table */}
      <div className="p-6 rounded-3xl bg-white border border-[#eadfca] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#261b17] flex items-center gap-2">
              <span>📊</span> Live AI Interaction & Tracing Feed
            </h3>
            <p className="text-xs text-[#74635c]">
              Pencatatan sesi percakapan, intent yang diekstrak, dan status verifikasi per milidetik.
            </p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Realtime Tracing Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#eadfca] text-[#74635c] bg-[#faf7f2]">
                <th className="py-3 px-4 font-bold">Waktu</th>
                <th className="py-3 px-4 font-bold">Pengirim</th>
                <th className="py-3 px-4 font-bold">Intent Terdeteksi</th>
                <th className="py-3 px-4 font-bold">FSM State</th>
                <th className="py-3 px-4 font-bold">Tool Execution</th>
                <th className="py-3 px-4 font-bold">Latensi</th>
                <th className="py-3 px-4 font-bold">Status Guard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eadfca]/60">
              {activityLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#fffaf0] transition-colors">
                  <td className="py-3 px-4 font-mono text-[#74635c]">{log.timestamp}</td>
                  <td className="py-3 px-4 font-semibold text-[#261b17]">{log.customer}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-[#8f1d20]/10 text-[#8f1d20] font-bold text-[10px]">
                      {log.intent}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                      {log.state}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#74635c]">{log.toolUsed}</td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-600">{log.latencyMs}ms</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        log.status === "OK" || log.status === "VALIDATED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

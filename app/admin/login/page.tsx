"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AVAILABLE_TENANTS, DEFAULT_TENANT_ID } from "../../../lib/mock-data";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_ID);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, tenantId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Login gagal.");
        return;
      }
      const next = searchParams.get("next") || "/admin";
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-[#a3948e] mb-1.5" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-xl bg-[#3d2c26] border border-[#5a4338] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d8a43b]"
          placeholder="admin"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-[#a3948e] mb-1.5" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-xl bg-[#3d2c26] border border-[#5a4338] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d8a43b]"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-[#a3948e] mb-1.5" htmlFor="tenant">
          Tenant (Restoran)
        </label>
        <select
          id="tenant"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-[#3d2c26] border border-[#5a4338] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d8a43b] cursor-pointer"
        >
          {AVAILABLE_TENANTS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.city}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs font-bold text-rose-400 bg-rose-950/50 border border-rose-800/40 rounded-lg px-3 py-2">
          ⚠️ {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8f1d20] to-[#6a1215] text-[#ffd98a] font-bold text-sm hover:from-[#a12124] hover:to-[#7d1519] transition-all shadow-lg disabled:opacity-60 cursor-pointer"
      >
        {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#261b17] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#33251f] border border-[#4a382f] rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#8f1d20] to-[#6a1215] flex items-center justify-center text-[#d8a43b] font-serif font-bold text-2xl shadow-lg">
            🔐
          </div>
          <h1 className="font-serif font-bold text-2xl text-white mt-4">Staff Portal</h1>
          <p className="text-xs text-[#a3948e] mt-1">
            Masuk untuk mengelola menu, meja, dan reservasi tenant Anda.
          </p>
        </div>
        <Suspense fallback={<p className="text-center text-xs text-[#a3948e]">Memuat form…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
